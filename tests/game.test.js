const { test } = require("node:test");
const assert = require("node:assert");

const {
  createInitialState,
  getActiveIndices,
  getActiveCellCoordinates,
  getShiftActions,
  getAvailableActions,
  applyAction,
  getWinner,
  isDraw,
  isCellInActiveGrid,
  canShiftGrid,
  getStateKey,
  getNextStateKey,
  wouldRepeatState,
  FIRST_PLAYER,
  FIRST_PLAYER_PIECES,
  MAX_PLACEMENTS_PER_PLAYER,
  SECOND_PLAYER
} = require("../dist/game.js");
const { chooseBestAction, minimax, getEngineEvaluations } = require("../dist/minimax.js");
const { registerEvaluationPlugin, getEvaluationPlugin, listEvaluationPlugins, DEFAULT_EVALUATION_PLUGIN } = require("../dist/evaluation.js");
const { runSelfPlayEpisode, runSelfPlayTraining } = require("../dist/learning.js");


const countPlacements = (board) =>
  board.reduce(
    (counts, cell) => {
      if (cell === "X") {
        counts.X += 1;
      } else if (cell === "O") {
        counts.O += 1;
      }
      return counts;
    },
    { X: 0, O: 0 }
  );

const hasActionType = (actions, type) => actions.some((action) => action.type === type);

test("X remains the first player with four pieces", () => {
  assert.strictEqual(FIRST_PLAYER, "X", "X must remain the first player");
  assert.strictEqual(SECOND_PLAYER, "O", "O must remain the second player");
  assert.strictEqual(FIRST_PLAYER_PIECES, 4, "First player should control four pieces");
});

test("active grid indices stay aligned with the highlighted window", () => {
  let state = createInitialState();
  const baseIndices = getActiveIndices(state);
  state = applyAction(state, { type: "place", index: baseIndices[0] }, "X");
  state = applyAction(state, { type: "place", index: baseIndices[1] }, "X");
  const shiftRight = getShiftActions(state).find((candidate) => candidate.dx === 1);
  assert(shiftRight, "Right shift should be available after the placement minimum");
  const moved = applyAction(state, shiftRight, "X");
  const [rowStart, rowEnd, colStart, colEnd] = getActiveCellCoordinates(moved);
  const activeIndices = getActiveIndices(moved);
  assert.strictEqual(activeIndices.length, 9, "Active grid should always contain nine cells");
  const unique = new Set(activeIndices);
  assert.strictEqual(unique.size, 9, "Active grid indices should be unique");
  for (const index of activeIndices) {
    const row = Math.floor(index / 5);
    const col = index % 5;
    assert(isCellInActiveGrid(moved, row, col), "Computed index should lie inside the active grid");
    assert(row >= rowStart && row <= rowEnd, "Row should be within the active window");
    assert(col >= colStart && col <= colEnd, "Column should be within the active window");
  }
});

test("shift actions respect the board edges", () => {
  let state = createInitialState();
  const activeIndices = getActiveIndices(state);
  state = applyAction(state, { type: "place", index: activeIndices[0] }, "O");
  state = applyAction(state, { type: "place", index: activeIndices[1] }, "O");
  const shiftLeft = getShiftActions(state).find((candidate) => candidate.dx === -1);
  assert(shiftLeft, "Left shift should be available once the minimum placements are made");
  state = applyAction(state, shiftLeft, "O");
  assert.strictEqual(state.activeX, 0, "Active grid should now touch the left edge");
  assert(!getShiftActions(state).some((candidate) => candidate.dx === -1));
  assert(canShiftGrid(state, 1, 0), "A right shift should still be valid from the left edge");
});

test("diagonal shifts respect board edges", () => {
  let state = createInitialState();
  const activeIndices = getActiveIndices(state);
  state = applyAction(state, { type: "place", index: activeIndices[0] }, "X");
  state = applyAction(state, { type: "place", index: activeIndices[1] }, "X");
  const diagonal = getShiftActions(state).find((candidate) => candidate.dx === 1 && candidate.dy === 1);
  assert(diagonal, "A diagonal shift should be available from the initial centered window");
  const previousX = state.activeX;
  const previousY = state.activeY;
  state = applyAction(state, diagonal, "X");
  assert.strictEqual(state.activeX, previousX + diagonal.dx);
  assert.strictEqual(state.activeY, previousY + diagonal.dy);
  assert(!getShiftActions(state).some((candidate) => candidate.dx === 1 && candidate.dy === 1));
});

test("shift actions become available only after placing two markers", () => {
  const state = createInitialState();
  assert.strictEqual(
    getAvailableActions(state, "X").filter((action) => action.type === "shift").length,
    0,
    "No shifts should appear until the placement minimum is met"
  );
  const targetIndices = getActiveIndices(state);
  let progressed = applyAction(state, { type: "place", index: targetIndices[0] }, "X");
  progressed = applyAction(progressed, { type: "place", index: targetIndices[1] }, "X");
  const shiftActions = new Set(
    getShiftActions(progressed).map((candidate) => `${candidate.dx},${candidate.dy}`)
  );
  const availableShifts = getAvailableActions(progressed, "X")
    .filter((action) => action.type === "shift")
    .map((shift) => `${shift.dx},${shift.dy}`);
  assert.strictEqual(
    availableShifts.length,
    shiftActions.size,
    "Each valid shift direction should show up after the placement minimum"
  );
  for (const direction of availableShifts) {
    assert(shiftActions.has(direction), `Shift ${direction} must be permitted by canShiftGrid`);
  }
});

test("move actions become available after the placement minimum", () => {
  const state = createInitialState();
  assert.strictEqual(
    getAvailableActions(state, "X").filter((action) => action.type === "move").length,
    0,
    "No moves should surface until the movement minimum is satisfied"
  );
  const targetIndices = getActiveIndices(state);
  let progressed = applyAction(state, { type: "place", index: targetIndices[0] }, "X");
  progressed = applyAction(progressed, { type: "place", index: targetIndices[1] }, "X");
  const moveActions = getAvailableActions(progressed, "X").filter((action) => action.type === "move");
  assert(moveActions.length > 0, "Move options should appear once movement is allowed");
  for (const move of moveActions) {
    assert.strictEqual(progressed.board[move.from], "X");
    assert(progressed.board[move.to] === " ");
  }
});

test("applyAction rejects moves before the placement minimum", () => {
  const state = createInitialState();
  assert.throws(
    () => applyAction(state, { type: "move", from: state.activeY * 5 + state.activeX, to: state.activeY * 5 + state.activeX + 1 }, "X"),
    { message: /moving a peg/i }
  );
});

test("applyAction prevents moves outside the active grid", () => {
  let state = createInitialState();
  const activeIndices = getActiveIndices(state);
  state = applyAction(state, { type: "place", index: activeIndices[0] }, "X");
  state = applyAction(state, { type: "place", index: activeIndices[1] }, "X");
  assert.throws(
    () => applyAction(state, { type: "move", from: activeIndices[0], to: 0 }, "X"),
    { message: /active grid/ }
  );
});

test("players cannot place more than four pieces", () => {
  const state = createInitialState();
  const activeIndices = getActiveIndices(state);
  let progressed = state;
  for (let i = 0; i < MAX_PLACEMENTS_PER_PLAYER; i += 1) {
    progressed = applyAction(progressed, { type: "place", index: activeIndices[i] }, "X");
  }
  const placementActions = getAvailableActions(progressed, "X").filter((action) => action.type === "place");
  assert.strictEqual(
    placementActions.length,
    0,
    "No placement actions remain once the four-piece limit is reached"
  );
  assert.throws(
    () => applyAction(progressed, { type: "place", index: activeIndices[MAX_PLACEMENTS_PER_PLAYER] }, "X"),
    { message: /Cannot place more than four pieces/ }
  );
});

test("placements are constrained to the active grid", () => {
  const state = createInitialState();
  const activeIndices = new Set(getActiveIndices(state));
  const actions = getAvailableActions(state, "X");
  const placementActions = actions.filter((action) => action.type === "place");
  assert.strictEqual(
    placementActions.length,
    getActiveIndices(state).length,
    "Every empty cell inside the active grid should become a placement action"
  );
  for (const action of placementActions) {
    assert(activeIndices.has(action.index), "Placement indexes stay within the active window");
  }
});

test("applyAction rejects placements on occupied cells", () => {
  const state = createInitialState();
  const targetIndex = state.activeY * 5 + state.activeX;
  const once = applyAction(state, { type: "place", index: targetIndex }, "X");
  assert.throws(
    () => applyAction(once, { type: "place", index: targetIndex }, "O"),
    { message: /occupied cell/ }
  );
});

test("applyAction rejects shifts before the placement minimum", () => {
  const state = createInitialState();
  const shiftDirection = getShiftActions(state)[0];
  assert(shiftDirection, "Shifts should exist on the empty board layout");
  assert.throws(
    () => applyAction(state, shiftDirection, "X"),
    { message: /place at least two pieces/i }
  );
});

test("applyAction prevents shifts outside the board", () => {
  let state = createInitialState();
  const activeIndices = getActiveIndices(state);
  state = applyAction(state, { type: "place", index: activeIndices[0] }, "X");
  state = applyAction(state, { type: "place", index: activeIndices[1] }, "X");
  const shiftLeft = getShiftActions(state).find((candidate) => candidate.dx === -1);
  assert(shiftLeft, "Left shift should be offered once placements allow shifting");
  state = applyAction(state, shiftLeft, "X");
  assert.throws(
    () => applyAction(state, { type: "shift", dx: -1, dy: 0 }, "X"),
    { message: /Invalid grid shift/ }
  );
});

test("winner detection ignores lines outside the active grid", () => {
  const state = createInitialState();
  const board = [...state.board];
  for (let col = 0; col < 5; col += 1) {
    board[col] = "X";
  }
  const outsideWin = {
    board,
    activeX: state.activeX,
    activeY: state.activeY,
    placementsByPlayer: countPlacements(board)
  };
  assert.strictEqual(getWinner(outsideWin), null);
});

test("winner detection recognizes lines inside the active grid", () => {
  const state = createInitialState();
  const board = [...state.board];
  const activeIndices = getActiveIndices(state);
  board[activeIndices[0]] = "O";
  board[activeIndices[1]] = "O";
  board[activeIndices[2]] = "O";
  const candidate = {
    board,
    activeX: state.activeX,
    activeY: state.activeY,
    placementsByPlayer: countPlacements(board)
  };
  assert.strictEqual(getWinner(candidate), "O", "Lines inside the active window should win");
});

test("minimax prefers finishing a winning line", () => {
  let state = createInitialState();
  const baseIndex = state.activeY * 5 + state.activeX;
  state = applyAction(state, { type: "place", index: baseIndex }, "X");
  state = applyAction(state, { type: "place", index: baseIndex + 1 }, "X");
  const action = chooseBestAction(state, "X", 6);
  assert.strictEqual(action.type, "place");
  assert.strictEqual(action.index, baseIndex + 2);
});

test("minimax chooses a shift when the active grid is full", () => {
  const state = createInitialState();
  const board = [...state.board];
  const fillPattern = ["X", "O", "X", "O", "O", "X", "X", "X", "O"];
  const activeIndices = getActiveIndices(state);
  for (let i = 0; i < activeIndices.length; i += 1) {
    board[activeIndices[i]] = fillPattern[i];
  }
  const fullState = {
    ...state,
    board,
    placementsByPlayer: {
      X: FIRST_PLAYER_PIECES,
      O: FIRST_PLAYER_PIECES
    }
  };
  assert.strictEqual(
    getAvailableActions(fullState, "X").filter((action) => action.type === "place").length,
    0,
    "No placements should remain once the active grid is filled"
  );
  const chosen = chooseBestAction(fullState, "X", 6);
  assert.strictEqual(chosen.type, "shift");
  assert.ok(chosen.dx !== 0 || chosen.dy !== 0, "Shift must move the grid");
});

test("minimax short-circuits on already visited states", () => {
  const state = createInitialState();
  const visited = new Set();
  visited.add(getStateKey(state, "X"));
  const result = minimax(state, "X", "X", 0, 2, visited);
  assert.strictEqual(result.score, 0);
  assert.strictEqual(result.action, undefined);
});

test("wouldRepeatState detects repeated positions", () => {
  const state = createInitialState();
  const action = { type: "place", index: state.activeY * 5 + state.activeX };
  const history = new Set();
  history.add(getNextStateKey(state, action, "X"));
  assert.strictEqual(wouldRepeatState(state, action, "X", history), true);
});

test("minimax returns the winning principal variation", () => {
  let state = createInitialState();
  const activeIndices = getActiveIndices(state);
  state = applyAction(state, { type: "place", index: activeIndices[0] }, "X");
  state = applyAction(state, { type: "place", index: activeIndices[1] }, "X");
  const result = minimax(state, "X", "X", 0, 4, new Set());
  assert.ok(result.pv.length > 0, "Principal variation should include at least one action");
  assert.strictEqual(result.pv[0].type, "place");
  assert.strictEqual(result.pv[0].index, activeIndices[2]);
  assert.ok(result.score > 0, "Winning line should produce a positive score for X");
});

test("engine evaluation reports multiple PVs sorted by score", () => {
  const evaluations = getEngineEvaluations(createInitialState(), "X", 3, 3);
  assert.ok(evaluations.length > 0, "Expect at least one evaluation entry");
  assert.ok(evaluations.every((entry) => entry.pv.length >= 1), "Each report should include at least the root action");
  assert.ok(evaluations.every((entry) => entry.pv[0] === entry.action), "Each PV should begin with the candidate action");
  for (let i = 1; i < evaluations.length; i += 1) {
    assert.ok(
      evaluations[i - 1].score >= evaluations[i].score,
      "Evaluations should be sorted from highest to lowest score"
    );
  }
});

test("draw detection stays false if a winner exists on a full board", () => {
  const board = Array.from({ length: 25 }, () => "X");
  const layout = [
    ["O", "O", "O"],
    ["X", "O", "X"],
    ["X", "X", "O"]
  ];
  for (let row = 1; row <= 3; row += 1) {
    for (let col = 1; col <= 3; col += 1) {
      board[row * 5 + col] = layout[row - 1][col - 1];
    }
  }
  const fullState = {
    board,
    activeX: 1,
    activeY: 1,
    placementsByPlayer: countPlacements(board)
  };
  assert.strictEqual(getWinner(fullState), "O");
  assert.strictEqual(isDraw(fullState), false);
});

test("evaluation plugin registry supports extensibility", () => {
  const sentinelPlugin = {
    name: "sentinel-ext",
    evaluate: () => 123
  };
  registerEvaluationPlugin(sentinelPlugin);
  const loaded = getEvaluationPlugin("sentinel-ext");
  assert.strictEqual(loaded.evaluate(null, "X", 0), 123);
  assert.strictEqual(getEvaluationPlugin("missing").name, DEFAULT_EVALUATION_PLUGIN.name);
  const availableNames = listEvaluationPlugins().map((plugin) => plugin.name);
  assert.ok(availableNames.includes(DEFAULT_EVALUATION_PLUGIN.name));
  assert.ok(availableNames.includes("sentinel-ext"));
});

test("self-play training scaffolding aggregates episodes", () => {
  const training = runSelfPlayTraining({ episodes: 2, depthLimit: 2, maxTurns: 10 });
  assert.strictEqual(training.episodes, 2);
  assert.strictEqual(training.results.length, 2);
  const coverage = training.winnerCounts.X + training.winnerCounts.O + training.winnerCounts.draw + training.winnerCounts.timeout;
  assert.strictEqual(coverage, 2);
  training.results.forEach((episode) => {
    assert.ok(episode.turnCount <= 10);
    assert.ok(episode.history.length <= 10);
  });
});

test("self-play episodes honor configured turn limits", () => {
  const episode = runSelfPlayEpisode({ depthLimit: 1, maxTurns: 5 });
  assert.ok(episode.turnCount <= 5);
  assert.ok(episode.history.length <= 5);
});
