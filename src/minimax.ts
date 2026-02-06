import { Action, applyAction, GameState, getAvailableActions, getOpponent, getStateKey, isDraw, getWinner } from "./game";
import { Player } from "./game";
import { DEFAULT_EVALUATION_PLUGIN, EvaluationFunction } from "./evaluation";

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
  evaluate: EvaluationFunction = defaultEvaluationFunction
): MinimaxResult => {
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
  const actions = getAvailableActions(state, currentPlayer);
  if (actions.length === 0) {
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
      const result = minimax(nextState, opponent, aiPlayer, depth + 1, maxDepth, visited, evaluate);
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
    const result = minimax(nextState, opponent, aiPlayer, depth + 1, maxDepth, visited, evaluate);
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
  depthLimit = 6,
  count = 3,
  evaluate: EvaluationFunction = defaultEvaluationFunction
): EngineEvaluation[] => {
  const actions = getAvailableActions(state, aiPlayer);
  if (actions.length === 0) {
    return [];
  }

  const opponent = getOpponent(aiPlayer);
  const rootKey = getStateKey(state, aiPlayer);

  const evaluations = actions.map((action) => {
    const nextState = applyAction(state, action, aiPlayer);
    const visited = new Set<string>([rootKey]);
    const result = minimax(nextState, opponent, aiPlayer, 1, depthLimit, visited, evaluate);
    return {
      score: result.score,
      action,
      pv: [action, ...result.pv]
    };
  });

  evaluations.sort((a, b) => b.score - a.score);
  return count > 0 ? evaluations.slice(0, count) : evaluations;
};

export const chooseBestAction = (
  state: GameState,
  aiPlayer: Player,
  depthLimit = 6,
  evaluate: EvaluationFunction = defaultEvaluationFunction
): Action => {
  const evaluations = getEngineEvaluations(state, aiPlayer, depthLimit, 1, evaluate);
  if (evaluations.length === 0) {
    throw new Error("Minimax could not find a move");
  }
  return evaluations[0].action;
};
