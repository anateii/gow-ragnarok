import * as vscode from "vscode";
import { MimirViewProvider } from "./mimirView";
import {
  Habit,
  MIN_BREAK_MS,
  Stage,
  WellbeingState,
  cooldownEndsAt,
  decay,
  initialState,
  isReminderDue,
  isTestFile,
  reward,
  stageOf,
} from "./wellbeing";
import { Situation, pick } from "./lines";

const STATE_KEY = "mimir.wellbeing";
const TICK_MS = 60_000;

/** What Mimir says when each habit is rewarded. */
const thanks: Record<Habit, Situation> = {
  break: "walkedAway",
  test: "testSaved",
  water: "water",
};

export class WellbeingTracker implements vscode.Disposable {
  private state: WellbeingState;
  private stage: Stage;
  private blurredAt?: number;
  private onBreak = false;
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
          this.record("test", pick("testsPassed"));
        }
      }),
    );
  }

  /**
   * Returns true if the save was a test file and Mimir reacted to it. When
   * `quiet`, the reward is still recorded but Mimir says nothing.
   */
  onSave(document: vscode.TextDocument, quiet = false): boolean {
    if (!isTestFile(document.uri.path)) {
      return false;
    }
    this.record("test", quiet ? null : pick(thanks.test));
    return true;
  }

  /**
   * During a break-mode break, focus changes and break reminders are ignored
   * so walking away mid-break isn't rewarded on top of finishing it.
   */
  setOnBreak(onBreak: boolean): void {
    this.onBreak = onBreak;
    this.blurredAt = undefined;
  }

  completeBreak(line: string): void {
    this.record("break", line);
  }

  drinkWater(): void {
    if (!this.record("water")) {
      this.mimir.say(pick("waterCooldown"));
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }

  private onFocus(focused: boolean): void {
    if (this.onBreak) {
      return;
    }
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

  /**
   * Rewards a habit; `line` is what Mimir says, or null to stay quiet.
   * Returns false if the habit was still on cooldown.
   */
  private record(
    habit: Habit,
    line: string | null = pick(thanks[habit]),
  ): boolean {
    const result = reward(this.state, habit, Date.now());
    this.state = result.state;
    if (result.rewarded) {
      this.lastNag[habit] = undefined;
      if (line !== null) {
        this.mimir.setMood("pleased", line);
      }
    }
    this.publish();
    return result.rewarded;
  }

  private tick(): void {
    const now = Date.now();
    this.state = decay(this.state, now);
    this.publish();
    if (this.onBreak || !vscode.window.state.focused) {
      return;
    }
    const config = vscode.workspace.getConfiguration("mimir");
    if (this.shouldNag("break", now, config.get("breakReminderMinutes", 60))) {
      this.mimir.setMood("annoyed", pick("breakReminder"));
    }
    if (this.shouldNag("water", now, config.get("waterReminderMinutes", 45))) {
      void vscode.window
        .showInformationMessage(`Mimir: ${pick("waterReminder")}`, "Drank it")
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
    this.mimir.setWaterReadyAt(cooldownEndsAt(this.state, "water"));
    if (next !== this.stage) {
      this.stage = next;
      this.mimir.say(pick(next));
    }
  }
}
