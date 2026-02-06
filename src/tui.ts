import { GameState, isCellInActiveGrid } from "./game";

const rowLabels = ["A", "B", "C", "D", "E"];
const columnLabels = ["1", "2", "3", "4", "5"];

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BG_GRAY = "\x1b[47m"; // White-ish background for active grid? Or maybe just brighter.
const YELLO_BG = "\x1b[43m";

const toCellChar = (cell: string): string => {
  if (cell === "X") return `${RED}X${RESET}`;
  if (cell === "O") return `${CYAN}O${RESET}`;
  return `${DIM}·${RESET}`;
};

const buildHeader = (): string => {
  const columns = columnLabels.map((label) => ` ${label} `).join("");
  return `  ${columns.trimEnd()}`;
};

export const renderBoard = (state: GameState): string => {
  const rows = rowLabels.map((label, rowIndex) => {
    const rowCells = columnLabels
      .map((_, columnIndex) => {
        const index = rowIndex * columnLabels.length + columnIndex;
        const char = toCellChar(state.board[index]);
        // Highlight active grid with bold brackets or background
        const isActive = isCellInActiveGrid(state, rowIndex, columnIndex);
        
        // Let's make active grid more visible.
        const left = isActive ? `${BOLD}[` : " ";
        const right = isActive ? `]${RESET}` : " ";
        
        return `${left}${char}${right}`;
      })
      .join("");
    return `${label} ${rowCells.trimEnd()}`;
  });

  return [buildHeader(), ...rows].join("\n");
};

export const clearScreen = (): void => {
  if (process.env.NO_CLEAR_SCREEN === "1") {
    process.stdout.write("\n\n");
    return;
  }
  process.stdout.write("\x1b[2J\x1b[0;0H");
};

export const renderHelp = (): string =>
  "Pick a move from the numbered list below. Use ai/auto to hand the current turn to the engine, restart/r to begin a new match, or exit/quit/q to leave.";
