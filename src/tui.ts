import { GameState, isCellInActiveGrid } from "./game";

const rowLabels = ["A", "B", "C", "D", "E"];
const columnLabels = ["1", "2", "3", "4", "5"];

const toCellChar = (cell: string): string => (cell === " " ? "·" : cell);

const buildHeader = (): string => {
  const columns = columnLabels.map((label) => ` ${label}  `).join("");
  return `    ${columns.trimEnd()}`;
};

export const renderBoard = (state: GameState): string => {
  const rows = rowLabels.map((label, rowIndex) => {
    const rowCells = columnLabels
      .map((_, columnIndex) => {
        const index = rowIndex * columnLabels.length + columnIndex;
        const char = toCellChar(state.board[index]);
        const cellText = isCellInActiveGrid(state, rowIndex, columnIndex) ? `[${char}]` : ` ${char} `;
        return `${cellText} `;
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
