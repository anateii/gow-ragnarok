import * as assert from "assert";
import { Situation, lines, pick, withReaction } from "../lines";

const situations = Object.keys(lines) as Situation[];

suite("Lines", () => {
  test("every situation has at least one line", () => {
    for (const situation of situations) {
      assert.ok(lines[situation].length > 0, situation);
    }
  });

  test("picks a line from the situation", () => {
    for (const situation of situations) {
      assert.ok(
        (lines[situation] as readonly string[]).includes(pick(situation)),
        situation,
      );
    }
  });

  test("never repeats the same line back to back", () => {
    let previous = pick("idle");
    for (let i = 0; i < 50; i++) {
      const next = pick("idle");
      assert.notStrictEqual(next, previous);
      previous = next;
    }
  });

  test("a single-line situation keeps returning it", () => {
    const [only] = lines.breakExpiredWhileAway;
    assert.strictEqual(pick("breakExpiredWhileAway"), only);
    assert.strictEqual(pick("breakExpiredWhileAway"), only);
  });

  test("puts the reaction before the details", () => {
    const line = withReaction("errorAppeared", "Line 3: Oops.");
    assert.ok(line.endsWith(" Line 3: Oops."));
    assert.ok(lines.errorAppeared.some((r) => line.startsWith(r)));
  });
});
