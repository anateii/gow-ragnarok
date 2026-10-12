// Pure rules for the Nine Realms tiles: project stats in, tiles out. No vscode
// imports so it can be unit tested.

export type RealmId =
  | "midgard"
  | "asgard"
  | "vanaheim"
  | "helheim"
  | "muspelheim"
  | "niflheim"
  | "alfheim"
  | "svartalfheim"
  | "jotunheim";

export interface ProjectStats {
  /** From package.json, or the folder name when there is none. */
  project?: { name: string; version?: string };
  /** Undefined when the folder isn't a git repository. */
  git?: { branch?: string; ahead: number; behind: number; changes: number };
  errors: number;
  warnings: number;
  /** Undefined until the first file scan finishes. */
  todos?: number;
  tests?: { files: number; lastRun?: "passed" | "failed" };
  /** Undefined when there's no package.json. */
  dependencies?: number;
  largestFile?: { name: string; lines: number };
}

export type Tone = "danger" | "warn" | "good";

export interface RealmTile {
  id: RealmId;
  name: string;
  /** Elder Futhark rune standing for the realm, e.g. "ᛁ". */
  rune: string;
  /** The rune's name and meaning, e.g. "Isa (ice)". */
  runeName: string;
  value: string;
  detail: string;
  tone?: Tone;
  tooltip: string;
}

/**
 * One Elder Futhark rune per realm, chosen by meaning (the myths don't assign
 * any, and the game's realm sigils aren't characters).
 */
export const REALM_RUNES: Record<RealmId, { rune: string; name: string; meaning: string }> = {
  midgard: { rune: "ᛗ", name: "Mannaz", meaning: "mankind" },
  asgard: { rune: "ᚨ", name: "Ansuz", meaning: "a god" },
  vanaheim: { rune: "ᛜ", name: "Ingwaz", meaning: "Freyr, growth" },
  helheim: { rune: "ᚺ", name: "Hagalaz", meaning: "hail, ruin" },
  muspelheim: { rune: "ᚲ", name: "Kenaz", meaning: "torch, fire" },
  niflheim: { rune: "ᛁ", name: "Isa", meaning: "ice" },
  alfheim: { rune: "ᛋ", name: "Sowilo", meaning: "the sun" },
  svartalfheim: { rune: "ᚷ", name: "Gebo", meaning: "gift, the forged treasures" },
  jotunheim: { rune: "ᚦ", name: "Thurisaz", meaning: "giant" },
};

/** From this many TODOs, Niflheim is "foggy" and glows. */
export const MANY_TODOS = 20;

const PENDING = "…";
const NONE = "—";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** The nine tiles in display order (three rows of three). */
export function buildTiles(stats: ProjectStats): RealmTile[] {
  const { project, git, errors, warnings, todos, tests, dependencies, largestFile } =
    stats;

  const tiles: Omit<RealmTile, "rune" | "runeName">[] = [
    {
      id: "midgard",
      name: "Midgard",
      value: project?.name ?? NONE,
      detail: project?.version ? `v${project.version}` : "no version",
      tooltip: "Midgard, home of humans: your project. Click to open package.json.",
    },
    {
      id: "asgard",
      name: "Asgard",
      value: git ? (git.branch ?? "detached") : NONE,
      detail: git ? `↑${git.ahead} ↓${git.behind}` : "no git repo",
      tooltip: "Asgard, throne of the gods: your git branch, commits ahead/behind. Click for Source Control.",
    },
    {
      id: "vanaheim",
      name: "Vanaheim",
      value: git ? String(git.changes) : NONE,
      detail: vanaheimDetail(git),
      tooltip: "Vanaheim, realm of growth: uncommitted changes. Click for Source Control.",
    },
    {
      id: "helheim",
      name: "Helheim",
      value: String(errors),
      detail: plural(errors, "error", "errors"),
      tone: errors > 0 ? "danger" : "good",
      tooltip: "Helheim, realm of the dead: errors across the workspace. Click for Problems.",
    },
    {
      id: "muspelheim",
      name: "Muspelheim",
      value: String(warnings),
      detail: plural(warnings, "warning", "warnings"),
      tone: warnings > 0 ? "warn" : undefined,
      tooltip: "Muspelheim, realm of fire: warnings across the workspace. Click for Problems.",
    },
    {
      id: "niflheim",
      name: "Niflheim",
      value: todos === undefined ? PENDING : String(todos),
      detail: todos === 1 ? "TODO" : "TODOs",
      tone: todos !== undefined && todos >= MANY_TODOS ? "warn" : undefined,
      tooltip: "Niflheim, realm of mist: TODO and FIXME comments. Click to search for them.",
    },
    {
      id: "alfheim",
      name: "Alfheim",
      value: tests === undefined ? PENDING : String(tests.files),
      detail: alfheimDetail(tests),
      tone: alfheimTone(tests),
      tooltip: "Alfheim, realm of light: test files and the last test run. Click to run the test task.",
    },
    {
      id: "svartalfheim",
      name: "Svartalfheim",
      value: dependencies === undefined ? NONE : String(dependencies),
      detail: dependencies === undefined ? "no package.json" : "dependencies",
      tooltip: "Svartalfheim, the dwarves' forges: tools forged by others. Click to open package.json.",
    },
    {
      id: "jotunheim",
      name: "Jötunheim",
      value: largestFile?.name ?? PENDING,
      detail: largestFile ? `${largestFile.lines} lines` : "largest file",
      tooltip: "Jötunheim, land of giants: your largest file. Click to open it.",
    },
  ];

  return tiles.map((tile) => {
    const { rune, name, meaning } = REALM_RUNES[tile.id];
    return { ...tile, rune, runeName: `${name} (${meaning})` };
  });
}

function vanaheimDetail(git: ProjectStats["git"]): string {
  if (!git) {
    return "no git repo";
  }
  if (git.changes === 0) {
    return "all committed";
  }
  return plural(git.changes, "file changed", "files changed");
}

function alfheimDetail(tests: ProjectStats["tests"]): string {
  if (tests?.lastRun === "passed") {
    return "✓ passing";
  }
  if (tests?.lastRun === "failed") {
    return "✗ failing";
  }
  return tests?.files === 1 ? "test file" : "test files";
}

function alfheimTone(tests: ProjectStats["tests"]): Tone | undefined {
  if (tests?.lastRun === "passed") {
    return "good";
  }
  if (tests?.lastRun === "failed") {
    return "danger";
  }
  return undefined;
}

const TODO_PATTERN = /\b(?:TODO|FIXME)\b/g;

export function countTodos(text: string): number {
  return text.match(TODO_PATTERN)?.length ?? 0;
}

export function countLines(text: string): number {
  if (text === "") {
    return 0;
  }
  const breaks = text.match(/\n/g)?.length ?? 0;
  // A trailing newline ends the last line rather than starting a new one.
  return text.endsWith("\n") ? breaks : breaks + 1;
}
