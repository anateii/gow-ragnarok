import * as vscode from "vscode";
import { formatCountdown } from "./countdown";
import { MimirViewProvider, getNonce } from "./mimirView";
import { WellbeingTracker } from "./wellbeingTracker";
import { pick } from "./lines";

const STATE_KEY = "mimir.break";

type Outcome = "completed" | "endedEarly" | "expiredWhileClosed";

interface BreakState {
  endsAt: number;
  /** The user's own global files.readonlyInclude, restored after the break. */
  previousReadonly: Record<string, boolean> | undefined;
}

/**
 * A soft lock: a full-screen break screen in Zen mode with every file
 * read-only until the timer runs out or the user ends the break early.
 */
export class BreakMode implements vscode.Disposable {
  private state?: BreakState;
  private panel?: vscode.WebviewPanel;
  private timer?: ReturnType<typeof setInterval>;
  private readonly status: vscode.StatusBarItem;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mimir: MimirViewProvider,
    private readonly wellbeing: WellbeingTracker,
  ) {
    this.status = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      101,
    );
    this.status.command = "mimir.takeBreak";
    this.status.tooltip =
      "Mimir break in progress. Click to show the break screen.";
  }

  /** Picks up a break that was running when VS Code closed or crashed. */
  async resume(): Promise<void> {
    const saved = this.context.globalState.get<BreakState>(STATE_KEY);
    if (!saved) {
      return;
    }
    this.state = saved;
    if (saved.endsAt > Date.now()) {
      await this.enter();
    } else {
      // Time ran out while VS Code was closed; the wellbeing tracker already
      // counts that downtime as a break, so just restore editing.
      await this.finish("expiredWhileClosed", pick("breakExpiredWhileAway"));
    }
  }

  async start(): Promise<void> {
    if (this.state) {
      this.showPanel();
      return;
    }
    const minutes = vscode.workspace
      .getConfiguration("mimir")
      .get("breakMinutes", 1);
    const files = vscode.workspace.getConfiguration("files");
    this.state = {
      endsAt: Date.now() + minutes * 60_000,
      previousReadonly:
        files.inspect<Record<string, boolean>>("readonlyInclude")?.globalValue,
    };
    // Save before touching settings so a crash mid-break can be undone.
    await this.context.globalState.update(STATE_KEY, this.state);
    await files.update(
      "readonlyInclude",
      { ...this.state.previousReadonly, "**": true },
      vscode.ConfigurationTarget.Global,
    );
    await this.enter();
  }

  async end(): Promise<void> {
    if (!this.state) {
      return;
    }
    await this.finish("endedEarly", pick("breakEndedEarly"));
  }

  dispose(): void {
    clearInterval(this.timer);
    this.status.dispose();
    // Leave the saved state in place: if VS Code is quitting mid-break, the
    // next activation resumes or cleans it up.
    const panel = this.panel;
    this.panel = undefined;
    panel?.dispose();
  }

  private async enter(): Promise<void> {
    this.wellbeing.setOnBreak(true);
    // There is no "enter Zen mode" command, so exit first to make the toggle
    // always land in Zen mode.
    await runQuietly("workbench.action.exitZenMode");
    await runQuietly("workbench.action.toggleZenMode");
    this.showPanel();
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
    this.status.show();
  }

  private tick(): void {
    if (!this.state) {
      return;
    }
    const now = Date.now();
    if (now >= this.state.endsAt) {
      void this.finish("completed", pick("breakCompleted"));
      return;
    }
    this.status.text = `☕ Break ${formatCountdown(this.state.endsAt, now)}`;
  }

  private async finish(outcome: Outcome, line: string): Promise<void> {
    const state = this.state;
    if (!state) {
      return;
    }
    this.state = undefined;
    clearInterval(this.timer);
    this.timer = undefined;
    this.status.hide();
    const panel = this.panel;
    this.panel = undefined;
    panel?.dispose();

    await vscode.workspace
      .getConfiguration("files")
      .update(
        "readonlyInclude",
        state.previousReadonly,
        vscode.ConfigurationTarget.Global,
      );
    await this.context.globalState.update(STATE_KEY, undefined);
    await runQuietly("workbench.action.exitZenMode");

    this.wellbeing.setOnBreak(false);
    if (outcome === "completed") {
      this.wellbeing.completeBreak(line);
    } else if (outcome === "endedEarly") {
      this.mimir.setMood("annoyed", line);
    } else {
      this.mimir.say(line);
    }
  }

  private showPanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "mimir.break",
      "Mimir: Break",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "assets",
      "mimir-head.png",
    );
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === "endBreak") {
        void this.end();
      }
    });
    panel.onDidDispose(() => {
      if (this.panel !== panel) {
        return; // We closed it ourselves.
      }
      this.panel = undefined;
      // Closing the screen doesn't end the break; bring it straight back.
      if (this.state) {
        this.showPanel();
      }
    });
    this.panel = panel;
    void this.render(panel.webview);
  }

  private async render(webview: vscode.Webview): Promise<void> {
    const root = this.context.extensionUri;
    const bytes = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(root, "break.html"),
    );
    const asset = (...path: string[]) =>
      webview.asWebviewUri(vscode.Uri.joinPath(root, ...path)).toString();
    webview.html = Buffer.from(bytes)
      .toString("utf8")
      .replaceAll("{{nonce}}", getNonce())
      .replaceAll("{{cspSource}}", webview.cspSource)
      .replaceAll("{{endsAt}}", String(this.state?.endsAt ?? Date.now()))
      .replaceAll("{{imageUri}}", asset("assets", "mimir-pleased.png"))
      .replaceAll("{{styleUri}}", asset("style.css"))
      .replaceAll("{{scriptUri}}", asset("dist", "break.js"));
  }
}

/** Runs a workbench command, ignoring "not applicable right now" failures. */
async function runQuietly(command: string): Promise<void> {
  try {
    await vscode.commands.executeCommand(command);
  } catch {
    // e.g. exitZenMode when not in Zen mode
  }
}
