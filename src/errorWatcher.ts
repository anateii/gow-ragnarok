import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import {
  ErrorInfo,
  describeError,
  newErrors,
  summarizeErrors,
} from "./errorReport";

// Diagnostics churn while typing; wait for them to settle before speaking.
const SETTLE_MS = 1000;

/**
 * Tells you exactly which errors appear in the file you're working on. An
 * error stays pinned on screen until a save leaves the file error-free.
 */
export class ErrorWatcher implements vscode.Disposable {
  private uri?: vscode.Uri;
  private known: ErrorInfo[] = [];
  private pinned = false;
  private saved = false;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly mimir: MimirViewProvider) {
    this.focus(vscode.window.activeTextEditor);
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => this.focus(editor)),
      vscode.languages.onDidChangeDiagnostics((e) => {
        const uri = this.uri?.toString();
        if (uri && e.uris.some((changed) => changed.toString() === uri)) {
          this.schedule();
        }
      }),
    );
  }

  /**
   * Returns true when the save belongs to the file whose error is pinned, in
   * which case this watcher decides what Mimir says about it.
   */
  onSave(document: vscode.TextDocument): boolean {
    if (!this.pinned || document.uri.toString() !== this.uri?.toString()) {
      return false;
    }
    // Some diagnostics (e.g. lint on save) arrive after the save itself.
    this.saved = true;
    this.schedule();
    return true;
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposables.forEach((d) => d.dispose());
  }

  private focus(editor: vscode.TextEditor | undefined): void {
    // Focusing a non-text editor (preview, webview) keeps the current file.
    if (!editor) {
      return;
    }
    clearTimeout(this.timer);
    this.saved = false;
    this.uri = editor.document.uri;
    this.known = errorsFor(this.uri);
    if (this.known.length > 0) {
      this.pin(summarizeErrors(this.known));
    } else {
      this.unpin();
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.check(), SETTLE_MS);
  }

  private check(): void {
    const next = errorsFor(this.uri);
    const fresh = newErrors(this.known, next);
    this.known = next;

    if (this.saved) {
      this.saved = false;
      if (next.length === 0) {
        this.unpin();
        this.mimir.setMood("pleased", "Clean. Not a single error left in this file.");
      } else {
        this.pin(describeError(fresh[0] ?? next[0], next.length));
      }
      return;
    }
    // While editing, only new errors change the message; fixes wait for a save.
    if (fresh.length > 0) {
      this.pin(describeError(fresh[0], next.length));
    }
  }

  private pin(line: string): void {
    this.pinned = true;
    this.mimir.pin("annoyed", line);
  }

  private unpin(): void {
    this.pinned = false;
    this.mimir.unpin();
  }
}

function errorsFor(uri: vscode.Uri | undefined): ErrorInfo[] {
  if (!uri) {
    return [];
  }
  return vscode.languages
    .getDiagnostics(uri)
    .filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
    .sort((a, b) => a.range.start.compareTo(b.range.start))
    .map((d) => ({ line: d.range.start.line + 1, message: d.message }));
}
