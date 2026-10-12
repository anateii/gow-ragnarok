import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import { BreakClock, WellbeingTracker } from "./wellbeingTracker";
import { Fatigue, formatSince } from "./wellbeing";
import { ErrorWatcher } from "./errorWatcher";
import { BreakMode } from "./breakMode";
import { RealmWatcher } from "./realmWatcher";import { pick } from "./lines";

export function activate(context: vscode.ExtensionContext): void {
  const mimir = new MimirViewProvider(context.extensionUri);

  context.subscriptions.push(
    // View
    vscode.window.registerWebviewViewProvider(MimirViewProvider.viewId, mimir),
  );
  const wellbeing = new WellbeingTracker(context, mimir);
  const errors = new ErrorWatcher(mimir);
  const breakMode = new BreakMode(context, mimir, wellbeing);
  const realms = new RealmWatcher(mimir);

  context.subscriptions.push(
    wellbeing,
    errors,
    breakMode,
    realms,

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
    createBreakClock(wellbeing),
  );

  void breakMode.resume();
  void realms.start();
}

export function deactivate(): void {}

const clockTooltips: Record<Fatigue, string> = {
  fresh: "Time since your last break.",
  due: "A break is due. Click to take one.",
  tired: "Over 90 minutes without a break: vitality drains twice as fast. Click to take one.",
  dozing: "Over 2 hours without a break: Mimir has dozed off. Click to take one.",
};

const clockColors: Record<Fatigue, string | undefined> = {
  fresh: undefined,
  due: "statusBarItem.warningBackground",
  tired: "statusBarItem.errorBackground",
  dozing: "statusBarItem.errorBackground",
};

/**
 * "⏱ 1h12m" since your last break: orange once a break is due, red once
 * skipping it starts to cost vitality. Hidden during a break.
 */
function createBreakClock(wellbeing: WellbeingTracker): vscode.Disposable {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99,
  );
  item.command = "mimir.takeBreak";
  const render = ({ sinceBreak, fatigue, onBreak }: BreakClock) => {
    if (onBreak) {
      item.hide();
      return;
    }
    item.text = `⏱ ${formatSince(sinceBreak)}`;
    item.tooltip = clockTooltips[fatigue];
    const color = clockColors[fatigue];
    item.backgroundColor = color ? new vscode.ThemeColor(color) : undefined;
    item.show();
  };
  render(wellbeing.clock);
  return vscode.Disposable.from(item, wellbeing.onDidUpdate(render));
}

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
