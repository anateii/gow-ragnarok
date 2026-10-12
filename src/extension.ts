import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import { WellbeingTracker } from "./wellbeingTracker";
import { ErrorWatcher } from "./errorWatcher";

const lines = [
  "Head's up, brother.",
  "That bracket is lying to you.",
  "I have seen worse realms than this file.",
  "Save your work. Even gods forget.",
];

export function activate(context: vscode.ExtensionContext): void {
  const mimir = new MimirViewProvider(context.extensionUri, lines);

  context.subscriptions.push(
    // View
    vscode.window.registerWebviewViewProvider(MimirViewProvider.viewId, mimir),
  );
  const wellbeing = new WellbeingTracker(context, mimir);
  const errors = new ErrorWatcher(mimir);

  context.subscriptions.push(
    wellbeing,
    errors,

    // Commands
    vscode.commands.registerCommand("mimir.summon", async () => {
      await vscode.commands.executeCommand("mimir.pet.focus");
      mimir.say(mimir.randomIdleLine());
    }),
    vscode.commands.registerCommand("mimir.drinkWater", () => {
      wellbeing.drinkWater();
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
      mimir.setMood("pleased", "Saved. Even gods forget, sometimes.");
    }),

    // Status bar
    createHorn(),
  );
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
