export type Player = "X" | "O";
export const FIRST_PLAYER: Player = "X";
export const SECOND_PLAYER: Player = "O";
export const FIRST_PLAYER_PIECES = 4;
export const MAX_PLACEMENTS_PER_PLAYER = FIRST_PLAYER_PIECES;
export type Cell = Player | " ";
export type Board = Cell[];

export interface GameState {
  board: Board;
  activeX: number;
  activeY: number;
  placementsByPlayer: Record<Player, number>;
}

export type ShiftDirection = { dx: number; dy: number };
export type MoveAction = { type: "move"; from: number; to: number };
export type Action =
  | { type: "place"; index: number }
  | { type: "shift"; dx: number; dy: number }
  | MoveAction;

export const BOARD_SIZE = 5;
export const ACTIVE_SIZE = 3;
export const INITIAL_ACTIVE_COORD = 1; // start the active grid near the center
export const PLACEMENTS_BEFORE_MOVEMENT = 2;

const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;

type WinningLine = [number, number][];
const relativeWinningLines: WinningLine[] = [
  [
    [0, 0],
    [0, 1],
    [0, 2]
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2]
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2]
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0]
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2]
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2]
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0]
  ]
];

export const createInitialState = (): GameState => ({
  board: Array.from({ length: TOTAL_CELLS }, () => " ") as Board,
  activeX: INITIAL_ACTIVE_COORD,
  activeY: INITIAL_ACTIVE_COORD,
  placementsByPlayer: { X: 0, O: 0 }
});

export const getOpponent = (player: Player): Player => (player === "X" ? "O" : "X");

const toIndex = (row: number, col: number): number => row * BOARD_SIZE + col;

export const getActiveIndices = ({ activeX, activeY }: GameState): number[] => {
  const indices: number[] = [];
  for (let row = 0; row < ACTIVE_SIZE; row += 1) {
    for (let col = 0; col < ACTIVE_SIZE; col += 1) {
      indices.push(toIndex(activeY + row, activeX + col));
    }
  }
  return indices;
};

export const isCellInActiveGrid = (state: GameState, row: number, col: number): boolean =>
  row >= state.activeY &&
  row < state.activeY + ACTIVE_SIZE &&
  col >= state.activeX &&
  col < state.activeX + ACTIVE_SIZE;

export const canShiftGrid = (state: GameState, dx: number, dy: number): boolean => {
  const targetX = state.activeX + dx;
  const targetY = state.activeY + dy;
  return (
    targetX >= 0 &&
    targetX <= BOARD_SIZE - ACTIVE_SIZE &&
    targetY >= 0 &&
    targetY <= BOARD_SIZE - ACTIVE_SIZE
  );
};

export const getShiftActions = (state: GameState): ShiftDirection[] => {
  const cardinal: ShiftDirection[] = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 }
  ];
  const diagonal: ShiftDirection[] = [
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 }
  ];
  return [...cardinal, ...diagonal].filter(({ dx, dy }) => canShiftGrid(state, dx, dy));
};

const hasReachedMovementMinimum = (state: GameState, player: Player): boolean =>
  state.placementsByPlayer[player] >= PLACEMENTS_BEFORE_MOVEMENT;

const hasReachedPlacementLimit = (state: GameState, player: Player): boolean =>
  state.placementsByPlayer[player] >= MAX_PLACEMENTS_PER_PLAYER;

const getPlayerPieceIndices = (state: GameState, player: Player): number[] =>
  state.board.reduce<number[]>((indices, cell, index) => {
    if (cell === player) {
      indices.push(index);
    }
    return indices;
  }, []);

const getMoveActions = (state: GameState, player: Player): MoveAction[] => {
  if (!hasReachedMovementMinimum(state, player)) {
    return [];
  }
  const ownedIndices = getPlayerPieceIndices(state, player);
  const emptyActiveIndices = getActiveIndices(state).filter((index) => state.board[index] === " ");
  if (!ownedIndices.length || !emptyActiveIndices.length) {
    return [];
  }
  const actions: MoveAction[] = [];
  for (const from of ownedIndices) {
    for (const to of emptyActiveIndices) {
      if (from === to) {
        continue;
      }
      actions.push({ type: "move", from, to });
    }
  }
  return actions;
};

export const getAvailableActions = (state: GameState, player: Player): Action[] => {
  const placements = hasReachedPlacementLimit(state, player)
    ? []
    : getActiveIndices(state)
        .filter((index) => state.board[index] === " ")
        .map((index) => ({ type: "place", index } as Action));
  const moves = getMoveActions(state, player);
  const shifts = hasReachedMovementMinimum(state, player)
    ? getShiftActions(state).map(({ dx, dy }) => ({ type: "shift", dx, dy } as Action))
    : [];
  return [...placements, ...moves, ...shifts];
};

export const applyAction = (state: GameState, action: Action, player: Player): GameState => {
  if (action.type === "place") {
    if (hasReachedPlacementLimit(state, player)) {
      throw new Error("Cannot place more than four pieces; move an existing peg instead");
    }
    if (state.board[action.index] !== " ") {
      throw new Error("Cannot place on an occupied cell");
    }
    const boardCopy = [...state.board] as Board;
    boardCopy[action.index] = player;
    return {
      board: boardCopy,
      activeX: state.activeX,
      activeY: state.activeY,
      placementsByPlayer: {
        ...state.placementsByPlayer,
        [player]: state.placementsByPlayer[player] + 1
      }
    };
  }

  if (action.type === "move") {
    if (!hasReachedMovementMinimum(state, player)) {
      throw new Error("Must place at least two pieces before moving a peg");
    }
    if (state.board[action.from] !== player) {
      throw new Error("Can only move your own pieces");
    }
    if (state.board[action.to] !== " ") {
      throw new Error("Destination cell must be empty");
    }
    const targetRow = Math.floor(action.to / BOARD_SIZE);
    const targetCol = action.to % BOARD_SIZE;
    if (!isCellInActiveGrid(state, targetRow, targetCol)) {
      throw new Error("Can only move into the active grid");
    }
    const boardCopy = [...state.board] as Board;
    boardCopy[action.from] = " ";
    boardCopy[action.to] = player;
    return {
      board: boardCopy,
      activeX: state.activeX,
      activeY: state.activeY,
      placementsByPlayer: { ...state.placementsByPlayer }
    };
  }

  if (!hasReachedMovementMinimum(state, player)) {
    throw new Error("Must place at least two pieces before shifting the grid");
  }

  if (!canShiftGrid(state, action.dx, action.dy)) {
    throw new Error("Invalid grid shift");
  }

  return {
    board: [...state.board] as Board,
    activeX: state.activeX + action.dx,
    activeY: state.activeY + action.dy,
    placementsByPlayer: { ...state.placementsByPlayer }
  };
};

export const getWinner = (state: GameState): Player | null => {
  const { board, activeX, activeY } = state;
  for (let i = 0; i < relativeWinningLines.length; i++) {
    const line = relativeWinningLines[i];
    const first = board[(activeY + line[0][0]) * BOARD_SIZE + activeX + line[0][1]];
    if (first === " ") continue;
    const second = board[(activeY + line[1][0]) * BOARD_SIZE + activeX + line[1][1]];
    if (second !== first) continue;
    const third = board[(activeY + line[2][0]) * BOARD_SIZE + activeX + line[2][1]];
    if (third === first) return first as Player;
  }
  return null;
};

export const isDraw = (state: GameState): boolean => {
  const { board } = state;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === " ") return false;
  }
  return !getWinner(state);
};

export const getStateKey = (state: GameState, currentPlayer: Player): string => {
  const { board, activeX, activeY, placementsByPlayer } = state;
  // Direct concatenation is faster than board.join("") for small arrays
  let key = "";
  for (let i = 0; i < board.length; i++) key += board[i];
  key += "|";
  key += activeX;
  key += ",";
  key += activeY;
  key += "|";
  key += currentPlayer;
  key += "|";
  key += placementsByPlayer.X;
  key += ",";
  key += placementsByPlayer.O;
  return key;
};

export const getActiveCellCoordinates = ({ activeX, activeY }: GameState): [number, number, number, number] => [
  activeY,
  activeY + ACTIVE_SIZE - 1,
  activeX,
  activeX + ACTIVE_SIZE - 1
];

export const getNextStateKey = (state: GameState, action: Action, player: Player): string => {
  const nextState = applyAction(state, action, player);
  const nextPlayer = getOpponent(player);
  return getStateKey(nextState, nextPlayer);
};

export const wouldRepeatState = (
  state: GameState,
  action: Action,
  player: Player,
  history: Set<string>
): boolean => history.has(getNextStateKey(state, action, player));
