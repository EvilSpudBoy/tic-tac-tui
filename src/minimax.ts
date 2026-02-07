import { Action, applyAction, GameState, getAvailableActions, getOpponent, getStateKey, isDraw, getWinner, Player } from "./game";
import { DEFAULT_EVALUATION_PLUGIN, EvaluationFunction } from "./evaluation";

export interface MinimaxStats {
  nodesVisited: number;
  cacheHits: number;
  cutoffs: number;
}

export interface MinimaxResult {
  score: number;
  action?: Action;
  pv: Action[];
}

const defaultEvaluationFunction: EvaluationFunction = DEFAULT_EVALUATION_PLUGIN.evaluate;

const evaluateTerminal = (state: GameState, winner: Player | null, aiPlayer: Player, depth: number, evaluate: EvaluationFunction): number =>
  evaluate(state, winner, aiPlayer, depth);

// --- Transposition table ---

const enum TTFlag {
  EXACT = 0,
  LOWERBOUND = 1,
  UPPERBOUND = 2,
}

interface TTEntry {
  score: number;
  depth: number; // remaining depth (maxDepth - depth)
  flag: TTFlag;
  bestAction?: Action;
}

// --- Move ordering ---
// Try moves in this priority: place-center, place-other, move, shift
// This helps alpha-beta prune more effectively.

const moveOrderScore = (action: Action, state: GameState): number => {
  if (action.type === "place") {
    // Prefer center of active grid
    const row = Math.floor(action.index / 5);
    const col = action.index % 5;
    const centerRow = state.activeY + 1;
    const centerCol = state.activeX + 1;
    if (row === centerRow && col === centerCol) return 100;
    // Prefer corners of active grid
    const dr = Math.abs(row - centerRow);
    const dc = Math.abs(col - centerCol);
    if (dr === 1 && dc === 1) return 80;
    return 60;
  }
  if (action.type === "move") return 40;
  return 20; // shift
};

const sortActions = (actions: Action[], state: GameState): void => {
  // In-place sort by move ordering heuristic (descending score = best first)
  actions.sort((a, b) => moveOrderScore(b, state) - moveOrderScore(a, state));
};

export const minimax = (
  state: GameState,
  currentPlayer: Player,
  aiPlayer: Player,
  depth: number,
  maxDepth: number,
  visited: Set<string>,
  history: Set<string>,
  stats: MinimaxStats,
  evaluate: EvaluationFunction = defaultEvaluationFunction,
  alpha: number = -Infinity,
  beta: number = Infinity,
  ttable: Map<string, TTEntry> | null = null
): MinimaxResult => {
  stats.nodesVisited++;

  const winner = getWinner(state);
  if (winner) {
    return { score: evaluateTerminal(state, winner, aiPlayer, depth, evaluate), pv: [] };
  }

  if (isDraw(state)) {
    return { score: evaluateTerminal(state, null, aiPlayer, depth, evaluate), pv: [] };
  }

  if (depth >= maxDepth) {
    return { score: evaluateTerminal(state, null, aiPlayer, depth, evaluate), pv: [] };
  }

  const key = getStateKey(state, currentPlayer);
  if (visited.has(key)) {
    return { score: evaluateTerminal(state, null, aiPlayer, depth, evaluate), pv: [] };
  }

  // --- Transposition table probe ---
  const remainingDepth = maxDepth - depth;
  if (ttable) {
    const entry = ttable.get(key);
    if (entry && entry.depth >= remainingDepth) {
      stats.cacheHits++;
      if (entry.flag === TTFlag.EXACT) {
        return { score: entry.score, action: entry.bestAction, pv: entry.bestAction ? [entry.bestAction] : [] };
      }
      if (entry.flag === TTFlag.LOWERBOUND) {
        alpha = Math.max(alpha, entry.score);
      } else if (entry.flag === TTFlag.UPPERBOUND) {
        beta = Math.min(beta, entry.score);
      }
      if (alpha >= beta) {
        stats.cutoffs++;
        return { score: entry.score, action: entry.bestAction, pv: entry.bestAction ? [entry.bestAction] : [] };
      }
    }
  }

  visited.add(key);

  // Filter actions that would lead to a state in history
  const allActions = getAvailableActions(state, currentPlayer);
  const actions = allActions.filter(action => {
    const nextState = applyAction(state, action, currentPlayer);
    const nextPlayer = getOpponent(currentPlayer);
    const nextKey = getStateKey(nextState, nextPlayer);
    return !history.has(nextKey);
  });

  if (actions.length === 0) {
    visited.delete(key);
    return { score: evaluateTerminal(state, null, aiPlayer, depth, evaluate), pv: [] };
  }

  // Move ordering for better alpha-beta cutoffs
  sortActions(actions, state);

  // If we have a TT best move, try it first
  if (ttable) {
    const ttEntry = ttable.get(key);
    if (ttEntry?.bestAction) {
      const bestIdx = actions.findIndex(a =>
        a.type === ttEntry.bestAction!.type &&
        JSON.stringify(a) === JSON.stringify(ttEntry.bestAction!)
      );
      if (bestIdx > 0) {
        const [best] = actions.splice(bestIdx, 1);
        actions.unshift(best);
      }
    }
  }

  const opponent = getOpponent(currentPlayer);
  const isMaximizing = currentPlayer === aiPlayer;

  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestAction: Action | undefined;
  let bestPV: Action[] = [];
  let localAlpha = alpha;
  let localBeta = beta;

  for (const action of actions) {
    const nextState = applyAction(state, action, currentPlayer);
    const result = minimax(
      nextState, opponent, aiPlayer, depth + 1, maxDepth,
      visited, history, stats, evaluate, localAlpha, localBeta, ttable
    );

    if (isMaximizing) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestAction = action;
        bestPV = [action, ...result.pv];
      }
      localAlpha = Math.max(localAlpha, bestScore);
    } else {
      if (result.score < bestScore) {
        bestScore = result.score;
        bestAction = action;
        bestPV = [action, ...result.pv];
      }
      localBeta = Math.min(localBeta, bestScore);
    }

    // Alpha-beta cutoff
    if (localAlpha >= localBeta) {
      stats.cutoffs++;
      break;
    }
  }

  // --- Transposition table store ---
  if (ttable) {
    let flag: TTFlag;
    if (bestScore <= alpha) {
      flag = TTFlag.UPPERBOUND;
    } else if (bestScore >= beta) {
      flag = TTFlag.LOWERBOUND;
    } else {
      flag = TTFlag.EXACT;
    }
    const existing = ttable.get(key);
    if (!existing || existing.depth <= remainingDepth) {
      ttable.set(key, { score: bestScore, depth: remainingDepth, flag, bestAction });
    }
  }

  visited.delete(key);
  return { score: bestScore, action: bestAction, pv: bestPV };
};

export interface EngineEvaluation {
  score: number;
  action: Action;
  pv: Action[];
}

export const getEngineEvaluations = (
  state: GameState,
  aiPlayer: Player,
  history: Set<string>,
  depthLimit = 6,
  count = 3,
  evaluate: EvaluationFunction = defaultEvaluationFunction
): { evaluations: EngineEvaluation[]; stats: MinimaxStats } => {
  const stats: MinimaxStats = { nodesVisited: 0, cacheHits: 0, cutoffs: 0 };
  const allActions = getAvailableActions(state, aiPlayer);
  const actions = allActions.filter(action => {
    const nextState = applyAction(state, action, aiPlayer);
    const nextPlayer = getOpponent(aiPlayer);
    const nextKey = getStateKey(nextState, nextPlayer);
    return !history.has(nextKey);
  });

  if (actions.length === 0) {
    return { evaluations: [], stats };
  }

  const opponent = getOpponent(aiPlayer);
  const rootKey = getStateKey(state, aiPlayer);

  // Shared transposition table across all root-move searches
  const ttable = new Map<string, TTEntry>();

  const evaluations = actions.map((action) => {
    const nextState = applyAction(state, action, aiPlayer);
    const visited = new Set<string>([rootKey]);
    const result = minimax(
      nextState, opponent, aiPlayer, 1, depthLimit,
      visited, history, stats, evaluate,
      -Infinity, Infinity, ttable
    );
    return {
      score: result.score,
      action,
      pv: [action, ...result.pv]
    };
  });

  evaluations.sort((a, b) => b.score - a.score);
  return {
    evaluations: count > 0 ? evaluations.slice(0, count) : evaluations,
    stats
  };
};

export const chooseBestAction = (
  state: GameState,
  aiPlayer: Player,
  history: Set<string>,
  depthLimit = 6,
  evaluate: EvaluationFunction = defaultEvaluationFunction
): Action => {
  const { evaluations } = getEngineEvaluations(state, aiPlayer, history, depthLimit, 1, evaluate);
  if (evaluations.length === 0) {
    throw new Error("Minimax could not find a move (all moves likely repeat history)");
  }
  return evaluations[0].action!;
};
