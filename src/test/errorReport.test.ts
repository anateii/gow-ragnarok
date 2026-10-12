import * as assert from "assert";
import {
  cleanMessage,
  describeError,
  newErrors,
  summarizeErrors,
} from "../errorReport";

suite("Error report", () => {
  test("keeps only the first line of a message", () => {
    assert.strictEqual(
      cleanMessage("Type 'string' is not assignable.\n  Details follow."),
      "Type 'string' is not assignable.",
    );
  });

  test("truncates very long messages", () => {
    const cleaned = cleanMessage("x".repeat(500));
    assert.strictEqual(cleaned.length, 140);
    assert.ok(cleaned.endsWith("…"));
  });

  test("detects errors that weren't there before", () => {
    const prev = [{ line: 3, message: "Cannot find name 'a'." }];
    const next = [
      { line: 3, message: "Cannot find name 'a'." },
      { line: 9, message: "Cannot find name 'b'." },
    ];
    assert.deepStrictEqual(newErrors(prev, next), [next[1]]);
  });

  test("an existing error that moved lines is not new", () => {
    const prev = [{ line: 3, message: "Cannot find name 'a'." }];
    const next = [{ line: 7, message: "Cannot find name 'a'." }];
    assert.deepStrictEqual(newErrors(prev, next), []);
  });

  test("a second copy of the same message counts as new", () => {
    const prev = [{ line: 3, message: "Missing ';'." }];
    const next = [
      { line: 3, message: "Missing ';'." },
      { line: 5, message: "Missing ';'." },
    ];
    assert.strictEqual(newErrors(prev, next).length, 1);
  });

  test("describes an error with its line and the file total", () => {
    const error = { line: 12, message: "Cannot find name 'foo'." };
    assert.strictEqual(
      describeError(error, 1),
      "Line 12: Cannot find name 'foo'.",
    );
    assert.strictEqual(
      describeError(error, 3),
      "Line 12: Cannot find name 'foo'. (3 errors in this file)",
    );
  });

  test("summarizes a file's errors", () => {
    assert.strictEqual(
      summarizeErrors([{ line: 4, message: "Oops." }]),
      "This file has an error. Line 4: Oops.",
    );
    assert.strictEqual(
      summarizeErrors([
        { line: 4, message: "Oops." },
        { line: 8, message: "Again." },
      ]),
      "This file has 2 errors. Line 4: Oops.",
    );
  });
});
