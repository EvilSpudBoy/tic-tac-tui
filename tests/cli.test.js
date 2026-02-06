const { test } = require("node:test");
const assert = require("node:assert");

const { parseStartupChoice, isAiHandOffCommand } = require("../dist/cli-utils.js");

test("parseStartupChoice defaults to the first player when empty", () => {
  assert.strictEqual(parseStartupChoice(""), "X");
  assert.strictEqual(parseStartupChoice("   "), "X");
});

test("parseStartupChoice recognizes O when requested", () => {
  assert.strictEqual(parseStartupChoice("O"), "O");
  assert.strictEqual(parseStartupChoice(" o "), "O");
});

test("parseStartupChoice accepts computer-vs-computer keywords", () => {
  assert.strictEqual(parseStartupChoice("C"), "SELF_PLAY");
  assert.strictEqual(parseStartupChoice("computer vs computer"), "SELF_PLAY");
  assert.strictEqual(parseStartupChoice("SELF-PLAY"), "SELF_PLAY");
  assert.strictEqual(parseStartupChoice("auto"), "SELF_PLAY");
});

test("parseStartupChoice returns null for invalid entries", () => {
  assert.strictEqual(parseStartupChoice("banana"), null);
  assert.strictEqual(parseStartupChoice("123"), null);
});

test("isAiHandOffCommand responds to ai or auto", () => {
  assert.strictEqual(isAiHandOffCommand("ai"), true);
  assert.strictEqual(isAiHandOffCommand("AI"), true);
  assert.strictEqual(isAiHandOffCommand("auto"), true);
  assert.strictEqual(isAiHandOffCommand("  auto  "), true);
  assert.strictEqual(isAiHandOffCommand("move"), false);
});
