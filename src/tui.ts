import { GameState, Player, FIRST_PLAYER_PIECES, isCellInActiveGrid, getActiveCellCoordinates } from "./game";

const rowLabels = ["A", "B", "C", "D", "E"];
const columnLabels = ["1", "2", "3", "4", "5"];

export const RESET = "\x1b[0m";
export const DIM = "\x1b[2m";
export const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";

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
        const isActive = isCellInActiveGrid(state, rowIndex, columnIndex);
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
  "Tab/↑↓: cycle moves · Type to filter · Enter: confirm · ai/restart/exit";

// --- Compact status bar ---

export const renderStatusBar = (
  state: GameState,
  current: Player,
  humanPlayer: Player
): string => {
  const [rowStart, rowEnd, colStart, colEnd] = getActiveCellCoordinates(state);
  const rowSlice = rowLabels.slice(rowStart, rowEnd + 1).join("-");
  const activeDesc = `${rowSlice} × ${colStart + 1}-${colEnd + 1}`;
  const nextActor = current === humanPlayer ? "You" : "AI";
  const xPlaced = state.placementsByPlayer.X;
  const oPlaced = state.placementsByPlayer.O;
  return `${BOLD}TicTacTwo${RESET} — ${nextActor} (${current}) to move | Active: ${activeDesc} | X: ${xPlaced}/${FIRST_PLAYER_PIECES}, O: ${oPlaced}/${FIRST_PLAYER_PIECES}`;
};

// --- Engine evaluation widget ---

export interface EvalWidgetData {
  evaluations: { score: number; pvText: string }[];
  depth: number;
  maxDepth: number;
  nodesVisited: number;
}

export const renderEvalWidget = (data: EvalWidgetData): string => {
  const header = `${DIM}── Engine (depth ${data.depth}/${data.maxDepth}) · Nodes: ${data.nodesVisited.toLocaleString()} ──${RESET}`;
  if (!data.evaluations.length) {
    return `${header}\n  ${DIM}(no evaluations)${RESET}`;
  }
  const lines = data.evaluations.map((e, i) => {
    const scoreText = e.score >= 0 ? `${GREEN}+${e.score}${RESET}` : `${RED}${e.score}${RESET}`;
    return `  ${i + 1}. ${scoreText} | ${e.pvText}`;
  });
  return [header, ...lines].join("\n");
};

// --- Scrollable move history window ---

export const HISTORY_WINDOW_SIZE = 4;

export const renderMoveHistoryWindow = (
  history: string[],
  offset: number
): string => {
  if (!history.length) return "";

  const total = history.length;
  const windowSize = HISTORY_WINDOW_SIZE;
  const clampedOffset = Math.min(offset, Math.max(0, total - windowSize));
  const visibleEnd = Math.min(clampedOffset + windowSize, total);
  const visible = history.slice(clampedOffset, visibleEnd);

  const canScrollUp = clampedOffset > 0;
  const canScrollDown = visibleEnd < total;
  const scrollHint = canScrollUp && canScrollDown
    ? " ▲▼"
    : canScrollUp ? " ▲" : canScrollDown ? " ▼" : "";

  const header = `${DIM}── History (${total} moves)${scrollHint} · PgUp/PgDn to scroll ──${RESET}`;
  const lines = visible.map(entry => `  ${entry}`);
  return [header, ...lines].join("\n");
};

// --- Move selector line ---

export const renderMoveSelectorLine = (
  entry: { label: string; action: { type: string } } | null,
  index: number,
  total: number,
  filterText: string
): string => {
  if (!entry) {
    return `${YELLOW}No moves match "${filterText}". Backspace to clear.${RESET}`;
  }
  const typeLabel = entry.action.type;
  const filterHint = filterText
    ? `${DIM}Filter: "${filterText}"${RESET}`
    : `${DIM}Type to filter${RESET}`;
  return `${GREEN}▸${RESET} [${BOLD}${typeLabel}${RESET}] ${entry.label}  ${DIM}(${index + 1}/${total})${RESET}  ${filterHint}`;
};
