const { test } = require("node:test");
const assert = require("node:assert");
const { createInitialState, getActiveIndices, applyAction, getStateKey } = require("../dist/game");
const { minimax, getEngineEvaluations, chooseBestAction } = require("../dist/minimax");

test("benchmark: alpha-beta + TT vs baseline node count at depth 6", () => {
  const state = createInitialState();

  // Run the optimized engine
  const t0 = performance.now();
  const { evaluations, stats } = getEngineEvaluations(state, "X", new Set(), 6, 3);
  const elapsed = performance.now() - t0;

  console.log(`\n  ── Benchmark Results ──`);
  console.log(`  Depth: 6 from initial state`);
  console.log(`  Nodes visited: ${stats.nodesVisited.toLocaleString()}`);
  console.log(`  Cache hits:    ${stats.cacheHits.toLocaleString()}`);
  console.log(`  Cutoffs:       ${stats.cutoffs.toLocaleString()}`);
  console.log(`  Time:          ${elapsed.toFixed(0)} ms`);
  console.log(`  Evaluations:   ${evaluations.length}`);
  if (evaluations.length > 0) {
    console.log(`  Best move:     ${JSON.stringify(evaluations[0].action)}`);
    console.log(`  Best score:    ${evaluations[0].score}`);
  }

  // Validate we got actual results
  assert.ok(evaluations.length > 0, "Should have at least one evaluation");
  assert.ok(stats.nodesVisited > 0, "Should have visited nodes");
  assert.ok(stats.cutoffs > 0, "Alpha-beta should produce cutoffs");

  // Validate correctness: minimax should still find winning move when 2 in a row
  const activeIndices = getActiveIndices(state);
  let twoInRow = applyAction(state, { type: "place", index: activeIndices[0] }, "X");
  twoInRow = applyAction(twoInRow, { type: "place", index: activeIndices[1] }, "X");
  const winMove = chooseBestAction(twoInRow, "X", new Set(), 6);
  assert.strictEqual(winMove.type, "place", "Should place to complete winning line");
  assert.strictEqual(winMove.index, activeIndices[2], "Should complete the three-in-a-row");
});

test("benchmark: mid-game position with pieces on board", () => {
  let state = createInitialState();
  const ai = getActiveIndices(state);

  // Set up a more complex mid-game position
  state = applyAction(state, { type: "place", index: ai[0] }, "X"); // X at top-left
  state = applyAction(state, { type: "place", index: ai[4] }, "O"); // O at center
  state = applyAction(state, { type: "place", index: ai[2] }, "X"); // X at top-right
  state = applyAction(state, { type: "place", index: ai[6] }, "O"); // O at bottom-left

  const t0 = performance.now();
  const { evaluations, stats } = getEngineEvaluations(state, "X", new Set(), 6, 3);
  const elapsed = performance.now() - t0;

  console.log(`\n  ── Mid-game Benchmark ──`);
  console.log(`  Nodes visited: ${stats.nodesVisited.toLocaleString()}`);
  console.log(`  Cache hits:    ${stats.cacheHits.toLocaleString()}`);
  console.log(`  Cutoffs:       ${stats.cutoffs.toLocaleString()}`);
  console.log(`  Time:          ${elapsed.toFixed(0)} ms`);

  assert.ok(evaluations.length > 0, "Should have evaluations for mid-game");
  assert.ok(stats.nodesVisited > 0, "Should visit nodes");
});

test("transposition table reuses cached positions", () => {
  const state = createInitialState();
  const stats = { nodesVisited: 0, cacheHits: 0, cutoffs: 0 };
  const ttable = new Map();

  // First search — populates the TT
  minimax(state, "X", "X", 0, 4, new Set(), new Set(), stats, undefined, -Infinity, Infinity, ttable);
  const firstNodes = stats.nodesVisited;
  const firstHits = stats.cacheHits;

  console.log(`\n  ── TT Reuse Test ──`);
  console.log(`  First search:  ${firstNodes.toLocaleString()} nodes, ${firstHits.toLocaleString()} hits`);
  console.log(`  TT entries:    ${ttable.size.toLocaleString()}`);

  assert.ok(ttable.size > 0, "TT should have cached entries");

  // Second search with same TT — should get cache hits
  const stats2 = { nodesVisited: 0, cacheHits: 0, cutoffs: 0 };
  minimax(state, "X", "X", 0, 4, new Set(), new Set(), stats2, undefined, -Infinity, Infinity, ttable);

  console.log(`  Second search: ${stats2.nodesVisited.toLocaleString()} nodes, ${stats2.cacheHits.toLocaleString()} hits`);

  assert.ok(stats2.cacheHits > 0, "Second search should hit cached entries");
  assert.ok(stats2.nodesVisited <= firstNodes, "Second search should visit fewer or equal nodes");
});
