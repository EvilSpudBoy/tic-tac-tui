
const assert = require("node:assert");
const { describe, it } = require("node:test");
const { createInitialState, getStateKey, FIRST_PLAYER } = require("../dist/game");
const { minimax } = require("../dist/minimax");
const { runSelfPlayTraining } = require("../dist/learning");

describe("Coverage Improvement Tests", () => {
  
  describe("Minimax Internals", () => {
    it("short-circuits when depth reaches maxDepth", () => {
      const state = createInitialState();
      const visited = new Set();
      const history = new Set();
      const stats = { nodesVisited: 0 };
      // Call with depth = maxDepth
      const result = minimax(state, FIRST_PLAYER, FIRST_PLAYER, 5, 5, visited, history, stats);
      assert.strictEqual(result.score, 0); // Should be neutral/0 because not terminal
      assert.strictEqual(result.pv.length, 0);
    });

    it("short-circuits when state is already in visited set", () => {
      const state = createInitialState();
      const visited = new Set();
      const key = getStateKey(state, FIRST_PLAYER);
      visited.add(key);
      const history = new Set();
      const stats = { nodesVisited: 0 };
      
      const result = minimax(state, FIRST_PLAYER, FIRST_PLAYER, 0, 5, visited, history, stats);
      assert.strictEqual(result.score, 0);
      assert.strictEqual(result.pv.length, 0);
    });
  });

  describe("Learning / Self-Play Outcomes", () => {
    it("handles timeouts (max turns reached)", () => {
      // Force a timeout by setting maxTurns really low
      const options = {
        episodes: 1,
        maxTurns: 1, // Should terminate immediately or after 1 move
        depthLimit: 1
      };
      
      const result = runSelfPlayTraining(options);
      assert.strictEqual(result.winnerCounts.timeout, 1);
      assert.strictEqual(result.winnerCounts.X, 0);
      assert.strictEqual(result.winnerCounts.O, 0);
      assert.strictEqual(result.winnerCounts.draw, 0);
    });

    it("handles game completion (Wins/Draws)", () => {
      // Run enough episodes with low depth to hopefully see a win or draw
      // Depth 1 is basically random/greedy, so likely someone wins or it fills up.
      const options = {
        episodes: 20,
        maxTurns: 50, // Enough to fill board
        depthLimit: 1
      };
      
      const result = runSelfPlayTraining(options);
      // We can't guarantee who wins, but we should see non-timeout results.
      // Assert that we have at least some wins or draws.
      const completed = result.winnerCounts.X + result.winnerCounts.O + result.winnerCounts.draw;
      assert.ok(completed > 0, "Should have at least one completed game (win or draw)");
      assert.strictEqual(result.winnerCounts.timeout, 0, "Should not timeout with ample turns");
    });
  });
});
