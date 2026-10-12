import * as assert from "assert";
import { formatCountdown } from "../countdown";

suite("Countdown", () => {
  test("formats minutes and zero-padded seconds", () => {
    assert.strictEqual(formatCountdown(15 * 60_000, 0), "15:00");
    assert.strictEqual(formatCountdown(65_000, 0), "1:05");
  });

  test("rounds partial seconds up so it never shows 0:00 early", () => {
    assert.strictEqual(formatCountdown(500, 0), "0:01");
  });

  test("never goes below zero", () => {
    assert.strictEqual(formatCountdown(0, 10_000), "0:00");
  });
});
