import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import {
  ProjectStats,
  RealmId,
  buildTiles,
  countLines,
  countTodos,
} from "./realms";
import { isTestFile } from "./wellbeing";

// Minimal slice of the built-in Git extension's API (vscode.git, version 1).
interface GitChange {
  uri: vscode.Uri;
}
interface GitRepository {
  rootUri: vscode.Uri;
  state: {
    HEAD?: { name?: string; ahead?: number; behind?: number };
    indexChanges: GitChange[];
    workingTreeChanges: GitChange[];
    mergeChanges: GitChange[];
    untrackedChanges?: GitChange[];
    onDidChange: vscode.Event<void>;
  };
}
interface GitAPI {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
  onDidCloseRepository: vscode.Event<GitRepository>;
}

const SCAN_EXCLUDE =
  "**/{node_modules,dist,out,build,coverage,.git,.vscode-test}/**";
const MAX_SCANNED_FILES = 2000;
const MAX_FILE_BYTES = 1_000_000;
const SCAN_DELAY_MS = 3000;
const DIAGNOSTICS_DELAY_MS = 300;
// Source files worth counting TODOs and lines in (no lockfiles, images, …).
const CODE_EXTENSIONS = new Set(
  "ts tsx js jsx mjs cjs py rb go rs java kt swift c h cpp hpp cs php vue svelte css scss less html sh".split(" "),
);

function isCodeFile(uri: vscode.Uri): boolean {
  const extension = uri.path.split(".").pop()?.toLowerCase() ?? "";
  return CODE_EXTENSIONS.has(extension);
}

/** Gathers project stats for the Nine Realms tiles and handles their clicks. */
export class RealmWatcher implements vscode.Disposable {
  private stats: ProjectStats = { errors: 0, warnings: 0 };
  private packageUri?: vscode.Uri;
  private largestUri?: vscode.Uri;
  private git?: GitAPI;
  private repo?: GitRepository;
  private repoListener?: vscode.Disposable;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private diagnosticsTimer?: ReturnType<typeof setTimeout>;
  // Bumped per scan so a slow, outdated scan can't overwrite a newer one.
  private scanId = 0;
  private lastPublished?: string;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly mimir: MimirViewProvider) {
    this.disposables.push(
      mimir.onDidClickRealm((id) => void this.open(id)),
      vscode.languages.onDidChangeDiagnostics(() => {
        clearTimeout(this.diagnosticsTimer);
        this.diagnosticsTimer = setTimeout(
          () => this.countDiagnostics(),
          DIAGNOSTICS_DELAY_MS,
        );
      }),
      vscode.workspace.onDidSaveTextDocument(() => this.scheduleScan()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => void this.refreshAll()),
      vscode.tasks.onDidEndTaskProcess((e) => {
        if (e.execution.task.group === vscode.TaskGroup.Test) {
          this.stats.tests = {
            files: this.stats.tests?.files ?? 0,
            lastRun: e.exitCode === 0 ? "passed" : "failed",
          };
          this.publish();
        }
      }),
    );
    // Only the root package.json matters; npm install touches hundreds more.
    const packageWatcher = vscode.workspace.createFileSystemWatcher("**/package.json");
    const onPackage = (uri: vscode.Uri) => {
      const root = this.root;
      if (root && uri.toString() === vscode.Uri.joinPath(root.uri, "package.json").toString()) {
        void this.readPackage();
      }
    };
    this.disposables.push(
      packageWatcher,
      packageWatcher.onDidChange(onPackage),
      packageWatcher.onDidCreate(onPackage),
      packageWatcher.onDidDelete(onPackage),
    );
  }

  /** Gathers everything once at startup; later updates are event driven. */
  async start(): Promise<void> {
    await this.connectGit();
    await this.refreshAll();
  }

  dispose(): void {
    clearTimeout(this.scanTimer);
    clearTimeout(this.diagnosticsTimer);
    this.repoListener?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  private get root(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
  }

  private async refreshAll(): Promise<void> {
    this.countDiagnostics();
    this.pickRepository();
    await this.readPackage();
    await this.scan();
  }

  private publish(): void {
    const tiles = buildTiles(this.stats);
    // Git and diagnostics fire often with nothing new; skip identical updates.
    const key = JSON.stringify(tiles);
    if (key === this.lastPublished) {
      return;
    }
    this.lastPublished = key;
    this.mimir.setRealms(tiles);
  }

  // --- Helheim & Muspelheim ------------------------------------------------

  private countDiagnostics(): void {
    let errors = 0;
    let warnings = 0;
    for (const [, diagnostics] of vscode.languages.getDiagnostics()) {
      for (const d of diagnostics) {
        if (d.severity === vscode.DiagnosticSeverity.Error) {
          errors++;
        } else if (d.severity === vscode.DiagnosticSeverity.Warning) {
          warnings++;
        }
      }
    }
    this.stats.errors = errors;
    this.stats.warnings = warnings;
    this.publish();
  }

  // --- Midgard & Svartalfheim ----------------------------------------------

  private async readPackage(): Promise<void> {
    const root = this.root;
    this.packageUri = undefined;
    this.stats.project = root ? { name: root.name } : undefined;
    this.stats.dependencies = undefined;
    if (root) {
      const uri = vscode.Uri.joinPath(root.uri, "package.json");
      try {
        const pkg = JSON.parse(
          Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8"),
        );
        this.packageUri = uri;
        this.stats.project = {
          name: typeof pkg.name === "string" ? pkg.name : root.name,
          version: typeof pkg.version === "string" ? pkg.version : undefined,
        };
        this.stats.dependencies =
          Object.keys(pkg.dependencies ?? {}).length +
          Object.keys(pkg.devDependencies ?? {}).length;
      } catch {
        // No package.json (or it's mid-edit and not valid JSON yet).
      }
    }
    this.publish();
  }

  // --- Asgard & Vanaheim ---------------------------------------------------

  private async connectGit(): Promise<void> {
    const extension =
      vscode.extensions.getExtension<{ getAPI(version: 1): GitAPI }>("vscode.git");
    if (!extension) {
      return;
    }
    try {
      const exports = extension.isActive
        ? extension.exports
        : await extension.activate();
      this.git = exports.getAPI(1);
    } catch {
      return; // Git disabled or unavailable: the tiles show "no git repo".
    }
    this.disposables.push(
      this.git.onDidOpenRepository(() => this.pickRepository()),
      this.git.onDidCloseRepository(() => this.pickRepository()),
    );
  }

  /** Follows the repository that contains the first workspace folder. */
  private pickRepository(): void {
    const rootPath = this.root?.uri.fsPath;
    const repo = this.git?.repositories.find(
      (r) => rootPath !== undefined && rootPath.startsWith(r.rootUri.fsPath),
    );
    if (repo !== this.repo) {
      this.repoListener?.dispose();
      this.repo = repo;
      this.repoListener = repo?.state.onDidChange(() => this.readGit());
    }
    this.readGit();
  }

  private readGit(): void {
    const state = this.repo?.state;
    if (!state) {
      this.stats.git = undefined;
    } else {
      const changed = new Set(
        [
          ...state.indexChanges,
          ...state.workingTreeChanges,
          ...state.mergeChanges,
          ...(state.untrackedChanges ?? []),
        ].map((change) => change.uri.toString()),
      );
      this.stats.git = {
        branch: state.HEAD?.name,
        ahead: state.HEAD?.ahead ?? 0,
        behind: state.HEAD?.behind ?? 0,
        changes: changed.size,
      };
    }
    this.publish();
  }

  // --- Niflheim, Alfheim & Jötunheim (file scan) ---------------------------

  private scheduleScan(): void {
    clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => void this.scan(), SCAN_DELAY_MS);
  }

  private async scan(): Promise<void> {
    const root = this.root;
    if (!root) {
      return;
    }
    const scan = ++this.scanId;
    const uris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, "**/*"),
      SCAN_EXCLUDE,
      MAX_SCANNED_FILES,
    );

    let todos = 0;
    let largest: { uri: vscode.Uri; lines: number } | undefined;
    const code = uris.filter(isCodeFile);
    // Read in small batches to keep the extension host responsive.
    for (let i = 0; i < code.length; i += 50) {
      const batch = await Promise.all(
        code.slice(i, i + 50).map(async (uri) => {
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            if (bytes.byteLength > MAX_FILE_BYTES) {
              return undefined;
            }
            return { uri, text: Buffer.from(bytes).toString("utf8") };
          } catch {
            return undefined;
          }
        }),
      );
      for (const file of batch) {
        if (!file) {
          continue;
        }
        todos += countTodos(file.text);
        const lines = countLines(file.text);
        if (!largest || lines > largest.lines) {
          largest = { uri: file.uri, lines };
        }
      }
    }
    if (scan !== this.scanId) {
      return; // A newer scan started meanwhile.
    }

    this.stats.todos = todos;
    this.stats.tests = {
      files: uris.filter((uri) => isTestFile(uri.path)).length,
      lastRun: this.stats.tests?.lastRun,
    };
    this.largestUri = largest?.uri;
    this.stats.largestFile = largest && {
      name: largest.uri.path.split("/").pop() ?? "",
      lines: largest.lines,
    };
    this.publish();
  }

  // --- Clicks ---------------------------------------------------------------

  private async open(id: RealmId): Promise<void> {
    switch (id) {
      case "midgard":
      case "svartalfheim":
        if (this.packageUri) {
          await vscode.window.showTextDocument(this.packageUri);
        }
        return;
      case "asgard":
      case "vanaheim":
        await vscode.commands.executeCommand("workbench.view.scm");
        return;
      case "helheim":
      case "muspelheim":
        await vscode.commands.executeCommand("workbench.actions.view.problems");
        return;
      case "niflheim":
        await vscode.commands.executeCommand("workbench.action.findInFiles", {
          query: String.raw`\b(TODO|FIXME)\b`,
          isRegex: true,
          triggerSearch: true,
        });
        return;
      case "alfheim":
        await vscode.commands.executeCommand("workbench.action.tasks.test");
        return;
      case "jotunheim":
        if (this.largestUri) {
          await vscode.window.showTextDocument(this.largestUri);
        }
        return;
    }
  }
}
