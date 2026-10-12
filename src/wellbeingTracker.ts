import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import {
  Habit,
  MIN_BREAK_MS,
  Stage,
  WellbeingState,
  decay,
  initialState,
  isReminderDue,
  isTestFile,
  reward,
  stageOf,
} from "./wellbeing";

const STATE_KEY = "mimir.wellbeing";
const TICK_MS = 60_000;

const thanks: Record<Habit, string> = {
  break: "You walked away and came back. Wise, brother.",
  test: "A test! Now the bugs have to fight fair.",
  water: "Water. Even the World Serpent stays hydrated.",
};

const stageLines: Record<Stage, string> = {
  thriving: "I feel like a young god again!",
  steady: "Steady, brother. Steady.",
  wilting: "I'm wilting here. A break, a test, some water... anything.",
};

export class WellbeingTracker implements vscode.Disposable {
  private state: WellbeingState;
  private stage: Stage;
  private blurredAt?: number;
  private lastNag: Partial<Record<Habit, number>> = {};
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mimir: MimirViewProvider,
  ) {
    const now = Date.now();
    const saved = context.globalState.get<WellbeingState>(STATE_KEY);
    // Don't drain vitality while VS Code was closed; being away is a break.
    this.state = saved ? { ...saved, lastUpdated: now } : initialState(now);
    if (saved && now - saved.lastUpdated >= MIN_BREAK_MS) {
      this.state = reward(this.state, "break", now).state;
    }
    this.stage = stageOf(this.state.vitality);
    this.publish();

    const timer = setInterval(() => this.tick(), TICK_MS);
    this.disposables.push(
      { dispose: () => clearInterval(timer) },
      vscode.window.onDidChangeWindowState((e) => this.onFocus(e.focused)),
      vscode.tasks.onDidEndTaskProcess((e) => {
        if (e.exitCode === 0 && e.execution.task.group === vscode.TaskGroup.Test) {
          this.record("test", "Green runes across the board!");
        }
      }),
    );
  }

  /** Returns true if the save was a test file and Mimir reacted to it. */
  onSave(document: vscode.TextDocument): boolean {
    if (!isTestFile(document.uri.path)) {
      return false;
    }
    this.record("test");
    return true;
  }

  drinkWater(): void {
    this.record("water");
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }

  private onFocus(focused: boolean): void {
    const now = Date.now();
    if (!focused) {
      this.blurredAt = now;
      return;
    }
    if (this.blurredAt !== undefined && now - this.blurredAt >= MIN_BREAK_MS) {
      this.record("break");
    }
    this.blurredAt = undefined;
  }

  private record(habit: Habit, line = thanks[habit]): void {
    const result = reward(this.state, habit, Date.now());
    this.state = result.state;
    if (result.rewarded) {
      this.lastNag[habit] = undefined;
      this.mimir.setMood("pleased", line);
    }
    this.publish();
  }

  private tick(): void {
    const now = Date.now();
    this.state = decay(this.state, now);
    this.publish();
    if (!vscode.window.state.focused) {
      return;
    }
    const config = vscode.workspace.getConfiguration("mimir");
    if (this.shouldNag("break", now, config.get("breakReminderMinutes", 60))) {
      this.mimir.setMood(
        "annoyed",
        "You've been staring at this realm for an hour. Stretch your legs.",
      );
    }
    if (this.shouldNag("water", now, config.get("waterReminderMinutes", 45))) {
      void vscode.window
        .showInformationMessage(
          "Mimir: Drink some water, brother. Heads need it too.",
          "Drank it",
        )
        .then((choice) => {
          if (choice === "Drank it") {
            this.drinkWater();
          }
        });
    }
  }

  private shouldNag(habit: Habit, now: number, minutes: number): boolean {
    if (!isReminderDue(this.state, habit, now, minutes)) {
      return false;
    }
    // Repeat a reminder at most once per interval.
    const last = this.lastNag[habit];
    if (last !== undefined && now - last < minutes * 60_000) {
      return false;
    }
    this.lastNag[habit] = now;
    return true;
  }

  private publish(): void {
    void this.context.globalState.update(STATE_KEY, this.state);
    const next = stageOf(this.state.vitality);
    this.mimir.setVitality(this.state.vitality, next);
    if (next !== this.stage) {
      this.stage = next;
      this.mimir.say(stageLines[next]);
    }
  }
}
