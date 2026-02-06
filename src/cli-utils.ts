import { FIRST_PLAYER, SECOND_PLAYER, Player } from "./game";

export type StartupChoice = Player | "SELF_PLAY";

const normalizeStartupInput = (value: string): string => value.trim().toUpperCase().replace(/[^A-Z]/g, "");

const SELF_PLAY_KEYWORDS = new Set([
  "C",
  "AI",
  "AUTO",
  "COMPUTER",
  "COMPUTERVSCOMPUTER",
  "SELF",
  "SELFPLAY",
  "SELFPLAYMODE"
]);

export const parseStartupChoice = (input?: string): StartupChoice | null => {
  if (!input?.trim()) {
    return FIRST_PLAYER;
  }
  const normalized = normalizeStartupInput(input);
  if (normalized === FIRST_PLAYER) {
    return FIRST_PLAYER;
  }
  if (normalized === SECOND_PLAYER) {
    return SECOND_PLAYER;
  }
  if (SELF_PLAY_KEYWORDS.has(normalized)) {
    return "SELF_PLAY";
  }
  return null;
};

const HANDOFF_COMMANDS = new Set(["ai", "auto"]);

export const isAiHandOffCommand = (input: string): boolean => {
  const normalized = input.trim().toLowerCase();
  return HANDOFF_COMMANDS.has(normalized);
};
