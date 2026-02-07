const assert = require("node:assert");
const { describe, it } = require("node:test");
const { createInitialState, applyAction, getStateKey, FIRST_PLAYER, SECOND_PLAYER } = require("../dist/game");
const { getEngineEvaluations } = require("../dist/minimax");

describe("Repetition handling modes", () => {
  it("strict mode filters actions that recreate a state from history", () => {
    const state = createInitialState();
    const blockedAction = { type: "place", index: 6 };
    const blockedNextState = applyAction(state, blockedAction, FIRST_PLAYER);
    const blockedKey = getStateKey(blockedNextState, SECOND_PLAYER);
    const history = new Set([blockedKey]);

    const { evaluations } = getEngineEvaluations(state, FIRST_PLAYER, history, 2, 100, undefined, "strict");
    const hasBlocked = evaluations.some(
      (entry) => entry.action.type === "place" && entry.action.index === blockedAction.index
    );
    assert.strictEqual(hasBlocked, false, "Strict repetition mode should hide history-repeating actions");
  });

  it("search mode does not forbid history-repeating actions at move-generation time", () => {
    const state = createInitialState();
    const repeatCandidate = { type: "place", index: 6 };
    const nextState = applyAction(state, repeatCandidate, FIRST_PLAYER);
    const repeatedKey = getStateKey(nextState, SECOND_PLAYER);
    const history = new Set([repeatedKey]);

    const { evaluations } = getEngineEvaluations(state, FIRST_PLAYER, history, 1, 100);
    const hasRepeatCandidate = evaluations.some(
      (entry) => entry.action.type === "place" && entry.action.index === repeatCandidate.index
    );
    assert.strictEqual(hasRepeatCandidate, true, "Default search mode should keep repeat candidates legal");
  });
});
