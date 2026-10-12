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
    createHorn(),
  );

  void breakMode.resume();
}

export function deactivate(): void {}

function createHorn(): vscode.StatusBarItem {
  const horn = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  horn.text = "⚡ Summon Mimir";
  horn.tooltip = "Open the Mimir pet view";
  horn.command = "mimir.summon";
  horn.show();
  return horn;
}
