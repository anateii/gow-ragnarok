import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import { WellbeingTracker } from "./wellbeingTracker";

const lines = [
  "Head's up, brother.",
  "That bracket is lying to you.",
  "I have seen worse realms than this file.",
  "Save your work. Even gods forget.",
];

export function activate(context: vscode.ExtensionContext): void {
  const mimir = new MimirViewProvider(context.extensionUri, lines);
  let errorCount = 0;

  context.subscriptions.push(
    // View
    vscode.window.registerWebviewViewProvider(MimirViewProvider.viewId, mimir),
  );
  const wellbeing = new WellbeingTracker(context, mimir);

  context.subscriptions.push(
    wellbeing,

    // Commands
    vscode.commands.registerCommand("mimir.summon", async () => {
      await vscode.commands.executeCommand("mimir.pet.focus");
      mimir.say(mimir.randomIdleLine());
    }),
    vscode.commands.registerCommand("mimir.throwRune", async () => {
      await vscode.commands.executeCommand("mimir.pet.focus");
      mimir.throwRune();
    }),
    vscode.commands.registerCommand("mimir.drinkWater", () => {
      wellbeing.drinkWater();
    }),

    // Reactions
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (wellbeing.onSave(document)) {
        return;
      }
      mimir.setMood("pleased", "Saved. Even gods forget, sometimes.");
    }),
    vscode.languages.onDidChangeDiagnostics(() => {
      const next = countErrors();
      if (next > errorCount) {
        mimir.setMood("annoyed", "That bracket is lying to you.");
      }
      errorCount = next;
    }),

    // Status bar
    createHorn(),
  );
}

export function deactivate(): void {}

function countErrors(): number {
  return vscode.languages.getDiagnostics().reduce((sum, [, list]) => {
    return (
      sum +
      list.filter((item) => item.severity === vscode.DiagnosticSeverity.Error)
        .length
    );
  }, 0);
}

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
