import * as assert from "assert";
import {
  MANY_TODOS,
  ProjectStats,
  RealmId,
  buildTiles,
  countLines,
  countTodos,
} from "../realms";

function tile(stats: ProjectStats, id: RealmId) {
  const found = buildTiles(stats).find((t) => t.id === id);
  assert.ok(found, id);
  return found;
}

const empty: ProjectStats = { errors: 0, warnings: 0 };

suite("Realms", () => {
  test("shows all nine realms in order", () => {
    assert.deepStrictEqual(
      buildTiles(empty).map((t) => t.id),
      [
        "midgard",
        "asgard",
        "vanaheim",
        "helheim",
        "muspelheim",
        "niflheim",
        "alfheim",
        "svartalfheim",
        "jotunheim",
      ],
    );
  });

  test("every realm has its own rune, with its name and meaning", () => {
    const tiles = buildTiles(empty);
    assert.strictEqual(new Set(tiles.map((t) => t.rune)).size, 9);
    assert.strictEqual(tile(empty, "niflheim").rune, "ᛁ");
    assert.strictEqual(tile(empty, "niflheim").runeName, "Isa (ice)");
  });

  test("Helheim glows red only when there are errors", () => {
    assert.strictEqual(tile({ ...empty, errors: 3 }, "helheim").tone, "danger");
    assert.strictEqual(tile({ ...empty, errors: 3 }, "helheim").detail, "errors");
    assert.strictEqual(tile(empty, "helheim").tone, "good");
    assert.strictEqual(tile({ ...empty, errors: 1 }, "helheim").detail, "error");
  });

  test("Muspelheim warns when there are warnings", () => {
    assert.strictEqual(tile({ ...empty, warnings: 2 }, "muspelheim").tone, "warn");
    assert.strictEqual(tile(empty, "muspelheim").tone, undefined);
  });

  test("Niflheim gets foggy with many TODOs", () => {
    assert.strictEqual(tile(empty, "niflheim").value, "…");
    assert.strictEqual(tile({ ...empty, todos: MANY_TODOS - 1 }, "niflheim").tone, undefined);
    assert.strictEqual(tile({ ...empty, todos: MANY_TODOS }, "niflheim").tone, "warn");
  });

  test("Asgard and Vanaheim show git state", () => {
    const git = { branch: "main", ahead: 2, behind: 1, changes: 0 };
    assert.strictEqual(tile({ ...empty, git }, "asgard").value, "main");
    assert.strictEqual(tile({ ...empty, git }, "asgard").detail, "↑2 ↓1");
    assert.strictEqual(tile({ ...empty, git }, "vanaheim").detail, "all committed");
    assert.strictEqual(
      tile({ ...empty, git: { ...git, changes: 4 } }, "vanaheim").detail,
      "files changed",
    );
    assert.strictEqual(tile(empty, "asgard").detail, "no git repo");
  });

  test("Alfheim reflects the last test run", () => {
    assert.strictEqual(
      tile({ ...empty, tests: { files: 5, lastRun: "failed" } }, "alfheim").tone,
      "danger",
    );
    assert.strictEqual(
      tile({ ...empty, tests: { files: 5, lastRun: "passed" } }, "alfheim").detail,
      "✓ passing",
    );
    assert.strictEqual(tile({ ...empty, tests: { files: 5 } }, "alfheim").value, "5");
  });

  test("Midgard and Svartalfheim read the project", () => {
    const stats = { ...empty, project: { name: "ragnarok", version: "1.2.0" }, dependencies: 11 };
    assert.strictEqual(tile(stats, "midgard").value, "ragnarok");
    assert.strictEqual(tile(stats, "midgard").detail, "v1.2.0");
    assert.strictEqual(tile(stats, "svartalfheim").value, "11");
    assert.strictEqual(tile(empty, "svartalfheim").detail, "no package.json");
  });

  test("counts TODO and FIXME as whole words", () => {
    assert.strictEqual(countTodos("// TODO: a\n// FIXME b\n// TODOS and FIXMEs"), 2);
  });

  test("counts lines, ignoring a trailing newline", () => {
    assert.strictEqual(countLines(""), 0);
    assert.strictEqual(countLines("a"), 1);
    assert.strictEqual(countLines("a\nb\n"), 2);
    assert.strictEqual(countLines("a\nb"), 2);
  });
});
