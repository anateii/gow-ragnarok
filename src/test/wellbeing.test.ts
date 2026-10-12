import * as assert from "assert";
import {
  COOLDOWNS,
  DECAY_PER_HOUR,
  GAINS,
  MAX_VITALITY,
  decay,
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

  test("reminders fall due after the interval and can be disabled", () => {
    const state = initialState(T0);
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
