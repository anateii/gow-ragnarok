import * as vscode from "vscode";

export class MimirViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "mimir.pet";
  private view?: vscode.WebviewView;
  private ready = false;
  private pendingLine?: string;
  private vitality?: { value: number; stage: string };

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly idleLines: string[],
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.ready = false;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.extensionUri,
        vscode.Uri.joinPath(this.extensionUri, "assets"),
      ],
    };
    // The webview reloads its script whenever it is shown again, so wait for
    // its "ready" before posting anything; earlier messages would be dropped.
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg?.type !== "ready") {
        return;
      }
      this.ready = true;
      if (this.vitality) {
        this.setVitality(this.vitality.value, this.vitality.stage);
      }
      this.say(this.pendingLine ?? this.randomIdleLine());
      this.pendingLine = undefined;
    });
    webviewView.onDidDispose(() => {
      this.view = undefined;
      this.ready = false;
    });
    void this.render(webviewView.webview);
  }

  say(line: string): void {
    if (!this.view || !this.ready) {
      this.pendingLine = line;
      return;
    }
    this.view.webview.postMessage({ type: "say", line });
  }

  randomIdleLine(): string {
    return this.idleLines[Math.floor(Math.random() * this.idleLines.length)];
  }

  setMood(mood: "idle" | "pleased" | "annoyed", line: string): void {
    this.view?.webview.postMessage({ type: "mood", mood, line });
  }

  setVitality(value: number, stage: string): void {
    this.vitality = { value, stage };
    if (this.ready) {
      this.view?.webview.postMessage({ type: "vitality", value, stage });
    }
  }

  throwRune(): void {
    this.view?.webview.postMessage({ type: "rune" });
  }

  private async render(webview: vscode.Webview): Promise<void> {
    const file = vscode.Uri.joinPath(this.extensionUri, "index.html");
    const bytes = await vscode.workspace.fs.readFile(file);
    const imageUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "assets", "mimir-head.png"),
    );
    const pleasedUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "assets", "mimir-pleased.png"),
    );
    const annoyedUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "assets", "mimir-annoyed.png"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "style.css"),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js"),
    );
    webview.html = Buffer.from(bytes)
      .toString("utf8")
      .replaceAll("{{nonce}}", getNonce())
      .replaceAll("{{cspSource}}", webview.cspSource)
      .replaceAll("{{imageUri}}", imageUri.toString())
      .replaceAll("{{styleUri}}", styleUri.toString())
      .replaceAll("{{scriptUri}}", scriptUri.toString())
      .replaceAll("{{pleasedUri}}", pleasedUri.toString())
      .replaceAll("{{annoyedUri}}", annoyedUri.toString());
  }
}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 32 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}
