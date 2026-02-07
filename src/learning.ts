import {
  Action,
  applyAction,
  createInitialState,
  FIRST_PLAYER,
  getOpponent,
  getWinner,
  GameState,
  getStateKey,
  isDraw,
  Player
} from "./game";
import { chooseBestAction, RepetitionRule } from "./minimax";
import { DEFAULT_EVALUATION_PLUGIN, EvaluationPlugin } from "./evaluation";

export interface SelfPlayTurn {
  stateBefore: GameState;
  player: Player;
  action: Action;
}

export interface SelfPlayEpisodeResult {
  winner: Player | null;
  turnCount: number;
  history: SelfPlayTurn[];
  terminatedByMaxTurns?: boolean;
}

export interface SelfPlayOptions {
  depthLimit?: number;
  evaluationPlugin?: EvaluationPlugin;
  evaluationPluginX?: EvaluationPlugin;
  evaluationPluginO?: EvaluationPlugin;
  maxTurns?: number;
  repetitionRule?: RepetitionRule;
}

export const runSelfPlayEpisode = (options: SelfPlayOptions = {}): SelfPlayEpisodeResult => {
  const fallbackPlugin = options.evaluationPlugin ?? DEFAULT_EVALUATION_PLUGIN;
  const evalPluginX = options.evaluationPluginX ?? fallbackPlugin;
  const evalPluginO = options.evaluationPluginO ?? fallbackPlugin;
  const depthLimit = options.depthLimit ?? 6;
  const maxTurns = options.maxTurns ?? 200;
  const repetitionRule = options.repetitionRule ?? "search";

  let state = createInitialState();
  let currentPlayer: Player = FIRST_PLAYER;
  const history: SelfPlayTurn[] = [];

    const historySet = new Set<string>();
    historySet.add(getStateKey(state, currentPlayer));

    for (let turn = 0; turn < maxTurns; turn += 1) {
      const winner = getWinner(state);
      if (winner || isDraw(state)) {
        return { winner, turnCount: turn, history };
      }

      const evalPlugin = currentPlayer === "X" ? evalPluginX : evalPluginO;
      const action = chooseBestAction(state, currentPlayer, historySet, depthLimit, evalPlugin.evaluate, repetitionRule);
      history.push({ stateBefore: state, player: currentPlayer, action });
      state = applyAction(state, action, currentPlayer);
      currentPlayer = getOpponent(currentPlayer);
      historySet.add(getStateKey(state, currentPlayer));
    }

  const finalWinner = getWinner(state);
  const draw = isDraw(state);
  return {
    winner: finalWinner ?? (draw ? null : null),
    turnCount: maxTurns,
    history,
    terminatedByMaxTurns: true
  };
};

export interface SelfPlayTrainingOptions extends SelfPlayOptions {
  episodes?: number;
  onEpisode?: (result: SelfPlayEpisodeResult, index: number) => void;
}

export interface SelfPlayTrainingResult {
  episodes: number;
  results: SelfPlayEpisodeResult[];
  winnerCounts: Record<Player | "draw" | "timeout", number>;
}

export const runSelfPlayTraining = (
  options: SelfPlayTrainingOptions = {}
): SelfPlayTrainingResult => {
  const episodes = options.episodes ?? 1;
  const episodeOptions: SelfPlayOptions = {
    depthLimit: options.depthLimit,
    evaluationPlugin: options.evaluationPlugin,
    evaluationPluginX: options.evaluationPluginX,
    evaluationPluginO: options.evaluationPluginO,
    maxTurns: options.maxTurns,
    repetitionRule: options.repetitionRule
  };

  const results: SelfPlayEpisodeResult[] = [];
  const winnerCounts: SelfPlayTrainingResult["winnerCounts"] = {
    X: 0,
    O: 0,
    draw: 0,
    timeout: 0
  };

  for (let index = 0; index < episodes; index += 1) {
    const episodeResult = runSelfPlayEpisode(episodeOptions);
    results.push(episodeResult);
    const { winner, terminatedByMaxTurns } = episodeResult;
    if (winner === "X") {
      winnerCounts.X += 1;
    } else if (winner === "O") {
      winnerCounts.O += 1;
    } else if (terminatedByMaxTurns) {
      winnerCounts.timeout += 1;
    } else {
      winnerCounts.draw += 1;
    }
    if (options.onEpisode) {
      options.onEpisode(episodeResult, index);
    }
  }

  return { episodes, results, winnerCounts };
};
