// Pure wellbeing rules for Mimir. No vscode imports so it can be unit tested.

export type Habit = "break" | "test" | "water";
export type Stage = "wilting" | "steady" | "thriving";
export type Fatigue = "fresh" | "due" | "tired" | "dozing";

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

// Skipping breaks gets progressively more expensive.
export const DUE_AFTER_MS = 60 * MINUTE;
export const TIRED_AFTER_MS = 90 * MINUTE;
export const DOZE_AFTER_MS = 120 * MINUTE;
export const FAST_DRAIN_MULTIPLIER = 2;

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

/**
 * Drains vitality since the last update. Time spent more than
 * TIRED_AFTER_MS past the last break drains FAST_DRAIN_MULTIPLIER times faster.
 */
export function decay(state: WellbeingState, now: number): WellbeingState {
  const from = state.lastUpdated;
  const to = Math.max(from, now);
  const tiredAt = state.lastHabit.break + TIRED_AFTER_MS;
  const normal = Math.max(0, Math.min(to, tiredAt) - from);
  const fast = to - from - normal;
  const drained =
    ((normal + fast * FAST_DRAIN_MULTIPLIER) / HOUR) * DECAY_PER_HOUR;
  return {
    ...state,
    vitality: clamp(state.vitality - drained),
    lastUpdated: now,
  };
}

export function msSinceBreak(state: WellbeingState, now: number): number {
  return Math.max(0, now - state.lastHabit.break);
}

/**
 * How worn out you are from skipping breaks:
 * - fresh: under an hour
 * - due: a break is due (status bar turns orange)
 * - tired: vitality drains faster (red)
 * - dozing: Mimir falls asleep until you take a break (red)
 */
export function fatigueOf(sinceBreak: number): Fatigue {
  if (sinceBreak >= DOZE_AFTER_MS) {
    return "dozing";
  }
  if (sinceBreak >= TIRED_AFTER_MS) {
    return "tired";
  }
  if (sinceBreak >= DUE_AFTER_MS) {
    return "due";
  }
  return "fresh";
}

/** "12m" under an hour, "1h05m" after. */
export function formatSince(ms: number): string {
  const totalMinutes = Math.floor(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0
    ? `${minutes}m`
    : `${hours}h${String(minutes).padStart(2, "0")}m`;
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
    intervalMinutes > 0 &&
    now - state.lastHabit[habit] >= intervalMinutes * MINUTE
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
