import { Action, applyAction, GameState, getAvailableActions, getOpponent, getStateKey, isDraw, getWinner, Player } from "./game";
import { DEFAULT_EVALUATION_PLUGIN, EvaluationFunction } from "./evaluation";

export interface MinimaxStats {
  nodesVisited: number;
}

export interface MinimaxResult {
  score: number;
  action?: Action;
  pv: Action[];
}

const defaultEvaluationFunction: EvaluationFunction = DEFAULT_EVALUATION_PLUGIN.evaluate;

const evaluateTerminal = (winner: Player | null, aiPlayer: Player, depth: number, evaluate: EvaluationFunction): number =>
  evaluate(winner, aiPlayer, depth);

export const minimax = (
  state: GameState,
  currentPlayer: Player,
  aiPlayer: Player,
  depth: number,
  maxDepth: number,
  visited: Set<string>,
  history: Set<string>,
  stats: MinimaxStats,
  evaluate: EvaluationFunction = defaultEvaluationFunction
): MinimaxResult => {
  stats.nodesVisited++;
  const winner = getWinner(state);
  if (winner) {
    return { score: evaluateTerminal(winner, aiPlayer, depth, evaluate), pv: [] };
  }

  if (isDraw(state)) {
    return { score: evaluateTerminal(null, aiPlayer, depth, evaluate), pv: [] };
  }

  if (depth >= maxDepth) {
    return { score: evaluateTerminal(null, aiPlayer, depth, evaluate), pv: [] };
  }

  const key = getStateKey(state, currentPlayer);
  if (visited.has(key)) {
    return { score: evaluateTerminal(null, aiPlayer, depth, evaluate), pv: [] };
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
    // Repetition or no moves
    visited.delete(key);
    return { score: evaluateTerminal(null, aiPlayer, depth, evaluate), pv: [] };
  }

  const opponent = getOpponent(currentPlayer);
  if (currentPlayer === aiPlayer) {
    let bestScore = -Infinity;
    let bestAction: Action | undefined;
    let bestPV: Action[] = [];

    for (const action of actions) {
      const nextState = applyAction(state, action, currentPlayer);
      const result = minimax(nextState, opponent, aiPlayer, depth + 1, maxDepth, visited, history, stats, evaluate);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestAction = action;
        bestPV = [action, ...result.pv];
      }
    }

    visited.delete(key);
    return { score: bestScore, action: bestAction, pv: bestPV };
  }

  let worstScore = Infinity;
  let worstAction: Action | undefined;
  let worstPV: Action[] = [];
  for (const action of actions) {
    const nextState = applyAction(state, action, currentPlayer);
    const result = minimax(nextState, opponent, aiPlayer, depth + 1, maxDepth, visited, history, stats, evaluate);
    if (result.score < worstScore) {
      worstScore = result.score;
      worstAction = action;
      worstPV = [action, ...result.pv];
    }
  }

  visited.delete(key);
  return { score: worstScore, action: worstAction, pv: worstPV };
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
  const stats: MinimaxStats = { nodesVisited: 0 };
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

  const evaluations = actions.map((action) => {
    const nextState = applyAction(state, action, aiPlayer);
    const visited = new Set<string>([rootKey]);
    // Note: We pass the *same* history down. 
    // It is debatable if we should add the 'nextState' to history for deeper search?
    // No, 'history' is what has ALREADY happened in the real game. 
    // 'visited' handles the current search path recursion.
    // However, if we make a move in the search, we shouldn't repeat THAT state later in the search either?
    // 'visited' handles cycles in the search tree. 'history' handles repetition of previous game states.
    const result = minimax(nextState, opponent, aiPlayer, 1, depthLimit, visited, history, stats, evaluate);
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
    // Fallback: If no moves allowed due to history (or just none), what do?
    // We should probably throw or return null, but the signature says Action.
    // If we are here, we truly have no moves or all are blocked by history.
    // The previous implementation threw.
    throw new Error("Minimax could not find a move (all moves likely repeat history)");
  }
  return evaluations[0].action!;
};
