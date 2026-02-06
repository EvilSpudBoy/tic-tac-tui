import { Player } from "./game";

export type EvaluationFunction = (winner: Player | null, aiPlayer: Player, depth: number) => number;

export interface EvaluationPlugin {
  readonly name: string;
  readonly evaluate: EvaluationFunction;
}

const defaultHeuristic: EvaluationFunction = (winner, aiPlayer, depth) => {
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
  evaluate: defaultHeuristic
};

const pluginRegistry = new Map<string, EvaluationPlugin>([[DEFAULT_EVALUATION_PLUGIN.name, DEFAULT_EVALUATION_PLUGIN]]);

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
