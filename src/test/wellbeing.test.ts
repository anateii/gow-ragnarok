import * as assert from "assert";
import {
  COOLDOWNS,
  DECAY_PER_HOUR,
  GAINS,
  DOZE_AFTER_MS,
  DUE_AFTER_MS,
  FAST_DRAIN_MULTIPLIER,
  MAX_VITALITY,
  TIRED_AFTER_MS,
  cooldownEndsAt,
  decay,
  fatigueOf,
  formatSince,
  msSinceBreak,
  initialState,
  isReminderDue,
  isTestFile,
  reward,
  stageOf,
} from "../wellbeing";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const T0 = 1_000_000_000_000;

suite("Wellbeing", () => {
  test("vitality decays over time and never drops below zero", () => {
    const state = initialState(T0);
    assert.strictEqual(
      decay(state, T0 + HOUR).vitality,
      state.vitality - DECAY_PER_HOUR,
    );
    assert.strictEqual(decay(state, T0 + 100 * HOUR).vitality, 0);
  });

  test("drain doubles once you're tired", () => {
    // Break at T0; update from 80 to 100 min: 10 min normal, 10 min doubled.
    const state = {
      ...initialState(T0),
      vitality: 50,
      lastUpdated: T0 + 80 * MINUTE,
    };
    const drained = 50 - decay(state, T0 + 100 * MINUTE).vitality;
    const perMinute = DECAY_PER_HOUR / 60;
    assert.ok(Math.abs(drained - perMinute * (10 + 10 * FAST_DRAIN_MULTIPLIER)) < 1e-9);
  });

  test("a break restores the normal drain rate", () => {
    const tired = { ...initialState(T0), lastUpdated: T0 + 3 * HOUR };
    const { state } = reward(tired, "break", T0 + 3 * HOUR);
    const drained = state.vitality - decay(state, T0 + 4 * HOUR).vitality;
    assert.ok(Math.abs(drained - DECAY_PER_HOUR) < 1e-9);
  });

  test("fatigue escalates with time since the last break", () => {
    assert.strictEqual(fatigueOf(59 * MINUTE), "fresh");
    assert.strictEqual(fatigueOf(DUE_AFTER_MS), "due");
    assert.strictEqual(fatigueOf(TIRED_AFTER_MS), "tired");
    assert.strictEqual(fatigueOf(DOZE_AFTER_MS), "dozing");
    assert.strictEqual(msSinceBreak(initialState(T0), T0 + HOUR), HOUR);
  });

  test("formats time since the last break", () => {
    assert.strictEqual(formatSince(0), "0m");
    assert.strictEqual(formatSince(12 * MINUTE + 59_000), "12m");
    assert.strictEqual(formatSince(HOUR + 5 * MINUTE), "1h05m");
    assert.strictEqual(formatSince(2 * HOUR + 30 * MINUTE), "2h30m");
  });

  test("decay ignores clocks that go backwards", () => {
    const state = initialState(T0);
    assert.strictEqual(decay(state, T0 - HOUR).vitality, state.vitality);
  });

  test("each habit raises vitality", () => {
    for (const habit of ["break", "test", "water"] as const) {
      const now = T0 + HOUR;
      const start = { ...initialState(T0), lastUpdated: now };
      const result = reward(start, habit, now);
      assert.ok(result.rewarded, habit);
      assert.strictEqual(result.state.vitality, start.vitality + GAINS[habit]);
      assert.strictEqual(result.state.lastHabit[habit], now);
    }
  });

  test("vitality is capped at the maximum", () => {
    const state = { ...initialState(T0), vitality: MAX_VITALITY - 1 };
    const { state: next } = reward(state, "break", T0);
    assert.strictEqual(next.vitality, MAX_VITALITY);
  });

  test("habits cannot be farmed during their cooldown", () => {
    const first = reward(initialState(T0), "test", T0).state;
    const spam = reward(first, "test", T0 + COOLDOWNS.test - 1);
    assert.strictEqual(spam.rewarded, false);
    assert.ok(spam.state.vitality <= first.vitality);

    const later = reward(first, "test", T0 + COOLDOWNS.test);
    assert.strictEqual(later.rewarded, true);
  });

  test("a fresh install can drink water straight away", () => {
    const state = initialState(T0);
    assert.ok(cooldownEndsAt(state, "water") <= T0);
    assert.strictEqual(reward(state, "water", T0).rewarded, true);
  });

  test("cooldown ends a fixed time after the habit", () => {
    const { state } = reward(initialState(T0), "water", T0 + HOUR);
    assert.strictEqual(cooldownEndsAt(state, "water"), T0 + HOUR + COOLDOWNS.water);
  });

  test("reminders fall due after the interval and can be disabled", () => {
    const { state } = reward(initialState(T0), "water", T0);
    assert.strictEqual(isReminderDue(state, "water", T0 + 44 * MINUTE, 45), false);
    assert.strictEqual(isReminderDue(state, "water", T0 + 45 * MINUTE, 45), true);
    assert.strictEqual(isReminderDue(state, "water", T0 + 10 * HOUR, 0), false);
  });

  test("stages follow vitality thresholds", () => {
    assert.strictEqual(stageOf(0), "wilting");
    assert.strictEqual(stageOf(29), "wilting");
    assert.strictEqual(stageOf(30), "steady");
    assert.strictEqual(stageOf(69), "steady");
    assert.strictEqual(stageOf(70), "thriving");
    assert.strictEqual(stageOf(100), "thriving");
  });

  test("recognises common test file names", () => {
    for (const path of [
      "/src/foo.test.ts",
      "/src/foo.spec.js",
      "/app/foo_spec.rb",
      "/pkg/foo_test.go",
      "/tests/test_foo.py",
      "/src/__tests__/foo.tsx",
      "C:\\src\\foo.test.ts",
    ]) {
      assert.ok(isTestFile(path), path);
    }
    for (const path of [
      "/src/foo.ts",
      "/src/contest.ts",
      "/src/latest.py",
      "/src/testing.ts",
      "/src/attest.spec",
    ]) {
      assert.ok(!isTestFile(path), path);
    }
  });
});
