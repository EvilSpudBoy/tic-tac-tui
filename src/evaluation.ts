import { GameState, Player, BOARD_SIZE, ACTIVE_SIZE, getActiveIndices } from "./game";

export type EvaluationFunction = (state: GameState, winner: Player | null, aiPlayer: Player, depth: number) => number;

export interface EvaluationPlugin {
  readonly name: string;
  readonly description: string;
  readonly evaluate: EvaluationFunction;
}

// ── Default (terminal-only) evaluation ──────────────────────────────

const defaultHeuristic: EvaluationFunction = (_state, winner, aiPlayer, depth) => {
  if (!winner) {
    return 0;
  }
  if (winner === aiPlayer) {
    return 10 - depth;
  }
  return depth - 10;
};

export const DEFAULT_EVALUATION_PLUGIN: EvaluationPlugin = {
  name: "default",
  description: "Terminal-only: +10-depth for wins, depth-10 for losses, 0 for draws",
  evaluate: defaultHeuristic
};

// ── Positional evaluation ───────────────────────────────────────────

/**
 * Winning lines expressed as relative [row, col] offsets within the 3×3 active grid.
 */
const RELATIVE_LINES: [number, number][][] = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]]
];

const toIndex = (row: number, col: number): number => row * BOARD_SIZE + col;

/**
 * Count "threats" (two-in-a-row with an empty third cell) for a given player
 * within the active grid.
 */
const countThreats = (state: GameState, player: Player): number => {
  let threats = 0;
  for (const line of RELATIVE_LINES) {
    const cells = line.map(([r, c]) => state.board[toIndex(state.activeY + r, state.activeX + c)]);
    const playerCount = cells.filter(c => c === player).length;
    const emptyCount = cells.filter(c => c === " ").length;
    if (playerCount === 2 && emptyCount === 1) {
      threats++;
    }
  }
  return threats;
};

/**
 * Count how many of a player's pieces are inside the current active grid.
 */
const countPiecesInActiveGrid = (state: GameState, player: Player): number => {
  const activeIndices = getActiveIndices(state);
  return activeIndices.filter(i => state.board[i] === player).length;
};

/**
 * Check if a player occupies the center cell of the active grid.
 */
const hasCenter = (state: GameState, player: Player): boolean => {
  const centerRow = state.activeY + 1;
  const centerCol = state.activeX + 1;
  return state.board[toIndex(centerRow, centerCol)] === player;
};

const positionalEvaluate: EvaluationFunction = (state, winner, aiPlayer, depth) => {
  const opponent = aiPlayer === "X" ? "O" : "X";

  // Terminal states still get decisive scores
  if (winner) {
    return winner === aiPlayer ? 100 - depth : depth - 100;
  }

  // Positional scoring for non-terminal positions
  let score = 0;

  // Threats (two-in-a-row with empty third): +3 per AI threat, -3 per opponent threat
  score += countThreats(state, aiPlayer) * 3;
  score -= countThreats(state, opponent) * 3;

  // Pieces in active grid: +1 per AI piece, -1 per opponent piece
  score += countPiecesInActiveGrid(state, aiPlayer);
  score -= countPiecesInActiveGrid(state, opponent);

  // Center control: +2 for AI, -2 for opponent
  if (hasCenter(state, aiPlayer)) score += 2;
  if (hasCenter(state, opponent)) score -= 2;

  return score;
};

export const POSITIONAL_EVALUATION_PLUGIN: EvaluationPlugin = {
  name: "positional",
  description: "Scores threats (two-in-a-row), center control, and active-grid presence",
  evaluate: positionalEvaluate
};

// ── Plugin registry ─────────────────────────────────────────────────

const pluginRegistry = new Map<string, EvaluationPlugin>([
  [DEFAULT_EVALUATION_PLUGIN.name, DEFAULT_EVALUATION_PLUGIN],
  [POSITIONAL_EVALUATION_PLUGIN.name, POSITIONAL_EVALUATION_PLUGIN]
]);

export const registerEvaluationPlugin = (plugin: EvaluationPlugin): void => {
  if (!plugin || typeof plugin.evaluate !== "function" || typeof plugin.name !== "string" || !plugin.name) {
    throw new Error("Evaluation plugins must include a non-empty name and an evaluate function");
  }
  pluginRegistry.set(plugin.name, plugin);
};

export const getEvaluationPlugin = (name?: string): EvaluationPlugin => {
  if (name && pluginRegistry.has(name)) {
    return pluginRegistry.get(name)!;
  }
  return DEFAULT_EVALUATION_PLUGIN;
};

export const listEvaluationPlugins = (): EvaluationPlugin[] => Array.from(pluginRegistry.values());
