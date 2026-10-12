// Pure wellbeing rules for Mimir. No vscode imports so it can be unit tested.

export type Habit = "break" | "test" | "water";
export type Stage = "wilting" | "steady" | "thriving";

export interface WellbeingState {
  vitality: number;
  lastUpdated: number;
  lastHabit: Record<Habit, number>;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const MAX_VITALITY = 100;
export const DECAY_PER_HOUR = 12;
export const MIN_BREAK_MS = 5 * MINUTE;

export const GAINS: Record<Habit, number> = {
  break: 20,
  test: 8,
  water: 12,
};

// Stops the same habit from being farmed (e.g. saving a test file in a loop).
export const COOLDOWNS: Record<Habit, number> = {
  break: 0,
  test: 2 * MINUTE,
  water: 15 * MINUTE,
};

export function initialState(now: number): WellbeingState {
  return {
    vitality: 50,
    lastUpdated: now,
    // Water is backdated by its cooldown so you can drink straight away.
    lastHabit: { break: now, test: 0, water: now - COOLDOWNS.water },
  };
}

/** When the habit can next be rewarded (in the past if it already can). */
export function cooldownEndsAt(state: WellbeingState, habit: Habit): number {
  return state.lastHabit[habit] + COOLDOWNS[habit];
}

export function decay(state: WellbeingState, now: number): WellbeingState {
  const elapsed = Math.max(0, now - state.lastUpdated);
  const vitality = clamp(state.vitality - (elapsed / HOUR) * DECAY_PER_HOUR);
  return { ...state, vitality, lastUpdated: now };
}

export function reward(
  state: WellbeingState,
  habit: Habit,
  now: number,
): { state: WellbeingState; rewarded: boolean } {
  const decayed = decay(state, now);
  if (now - state.lastHabit[habit] < COOLDOWNS[habit]) {
    return { state: decayed, rewarded: false };
  }
  return {
    state: {
      ...decayed,
      vitality: clamp(decayed.vitality + GAINS[habit]),
      lastHabit: { ...decayed.lastHabit, [habit]: now },
    },
    rewarded: true,
  };
}

export function isReminderDue(
  state: WellbeingState,
  habit: Habit,
  now: number,
  intervalMinutes: number,
): boolean {
  return (
    intervalMinutes > 0 && now - state.lastHabit[habit] >= intervalMinutes * MINUTE
  );
}

export function stageOf(vitality: number): Stage {
  if (vitality >= 70) {
    return "thriving";
  }
  if (vitality < 30) {
    return "wilting";
  }
  return "steady";
}

const TEST_FILE =
  /([._-](test|spec)\.[^./\\]+$)|((^|[/\\])test_[^/\\]+\.py$)|([/\\]__tests__[/\\])/i;

export function isTestFile(path: string): boolean {
  return TEST_FILE.test(path);
}

function clamp(value: number): number {
  return Math.min(MAX_VITALITY, Math.max(0, value));
}
