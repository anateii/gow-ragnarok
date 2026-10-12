import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import { WellbeingTracker } from "./wellbeingTracker";
import { ErrorWatcher } from "./errorWatcher";
import { BreakMode } from "./breakMode";
import { pick } from "./lines";

export function activate(context: vscode.ExtensionContext): void {
  const mimir = new MimirViewProvider(context.extensionUri);

  context.subscriptions.push(
    // View
    vscode.window.registerWebviewViewProvider(MimirViewProvider.viewId, mimir),
  );
  const wellbeing = new WellbeingTracker(context, mimir);
  const errors = new ErrorWatcher(mimir);
  const breakMode = new BreakMode(context, mimir, wellbeing);

  context.subscriptions.push(
    wellbeing,
    errors,
    breakMode,

    // Commands
    vscode.commands.registerCommand("mimir.summon", async () => {
      await vscode.commands.executeCommand("mimir.pet.focus");
      mimir.say(pick("idle"));
    }),
    vscode.commands.registerCommand("mimir.drinkWater", () => {
      wellbeing.drinkWater();
    }),
    vscode.commands.registerCommand("mimir.takeBreak", () => breakMode.start()),
    vscode.commands.registerCommand("mimir.endBreak", () => breakMode.end()),
    vscode.commands.registerCommand("mimir.remindBreak", () => {
      wellbeing.remindBreak();
    }),

    // Reactions
    vscode.workspace.onDidSaveTextDocument((document) => {
      // While an error is pinned, the error watcher has the final word on a
      // save; still credit test files, just without a competing line.
      const errorsHandled = errors.onSave(document);
      const testHandled = wellbeing.onSave(document, errorsHandled);
      if (errorsHandled || testHandled) {
        return;
      }
      mimir.setMood("pleased", pick("saved"));
    }),

    // Status bar
    createHorn(wellbeing),
  );

  void breakMode.resume();
}

export function deactivate(): void {}

/**
 * The "Summon Mimir" status bar item. While a break reminder is unanswered it
 * turns into a highlighted "Time for a break" that starts one when clicked.
 */
function createHorn(wellbeing: WellbeingTracker): vscode.Disposable {
  const horn = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  const render = (breakDue: boolean) => {
    horn.text = breakDue ? "☕ Time for a break" : "⚡ Summon Mimir";
    horn.tooltip = breakDue
      ? "Mimir thinks you need a break. Click to start one."
      : "Open the Mimir pet view";
    horn.command = breakDue ? "mimir.takeBreak" : "mimir.summon";
    horn.backgroundColor = breakDue
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
  };
  render(false);
  horn.show();
  return vscode.Disposable.from(
    horn,
    wellbeing.onDidChangeBreakDue(render),
  );
}
