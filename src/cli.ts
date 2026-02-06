import readline from "readline";
import {
  Action,
  BOARD_SIZE,
  FIRST_PLAYER,
  FIRST_PLAYER_PIECES,
  GameState,
  Player,
  SECOND_PLAYER,
  applyAction,
  createInitialState,
  getActiveCellCoordinates,
  getAvailableActions,
  getOpponent,
  getStateKey,
  getWinner,
  isDraw
} from "./game";
import { chooseBestAction, getEngineEvaluations } from "./minimax";
import { clearScreen, renderBoard, renderHelp } from "./tui";
import { parseStartupChoice, isAiHandOffCommand } from "./cli-utils";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

type Prompt = (query: string) => Promise<string>;

const prompt: Prompt = (query) =>
  new Promise((resolve) => rl.question(query, (answer) => resolve(answer.trim())));

const rowLabels = ["A", "B", "C", "D", "E"];
const directionLabels: Record<string, string> = {
  "-1,0": "left",
  "1,0": "right",
  "0,-1": "up",
  "0,1": "down",
  "-1,-1": "up-left",
  "1,-1": "up-right",
  "-1,1": "down-left",
  "1,1": "down-right"
};

const moveHistory: string[] = [];
const MAX_MOVE_HISTORY = 8;

const formatSquare = (index: number): string => {
  const row = rowLabels[Math.floor(index / BOARD_SIZE)];
  const col = (index % BOARD_SIZE) + 1;
  return `${row}${col}`;
};

const describeAction = (action: Action): string => {
  switch (action.type) {
    case "place":
      return `place ${formatSquare(action.index)}`;
    case "move":
      return `move ${formatSquare(action.from)} → ${formatSquare(action.to)}`;
    default: {
      const directionKey = `${action.dx},${action.dy}`;
      const directionLabel = directionLabels[directionKey] || `dx ${action.dx}, dy ${action.dy}`;
      return `shift ${directionLabel}`;
    }
  }
};

const recordMove = (player: Player, action: Action): void => {
  moveHistory.unshift(`[${player}] ${describeAction(action)}`);
  if (moveHistory.length > MAX_MOVE_HISTORY) {
    moveHistory.pop();
  }
};

const renderMoveHistory = (): void => {
  if (!moveHistory.length) {
    return;
  }
  console.log("\nMove history:");
  moveHistory.forEach((entry) => console.log(`  ${entry}`));
};

const args = process.argv.slice(2);
const parseNumericArg = (flag: string, defaultValue: number): number => {
  const entry = args.find((item) => item.startsWith(`${flag}=`));
  if (!entry) {
    return defaultValue;
  }
  const [, value] = entry.split("=");
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const engineDepth = parseNumericArg("--engine-depth", 6);
const multiPvCount = parseNumericArg("--multi-pv", 3);
const selfPlayMode = args.includes("--self-play");

const describeActiveGrid = (state: GameState): string => {
  const [rowStart, rowEnd, colStart, colEnd] = getActiveCellCoordinates(state);
  const rows = rowLabels.slice(rowStart, rowEnd + 1).join("-");
  return `Active grid rows ${rows}, cols ${colStart + 1}-${colEnd + 1}`;
};

const formatPrincipalVariation = (pv: Action[]): string => {
  if (!pv.length) {
    return "<none>";
  }
  return pv.map(describeAction).join(" → ");
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type ActionMenuEntry = {
  action: Action;
  label: string;
  repeats: boolean;
  nextState: GameState;
  nextPlayer: Player;
  nextStateKey: string;
};

const buildActionMenu = (
  state: GameState,
  player: Player,
  history: Set<string>
): ActionMenuEntry[] => {
  const opponent = getOpponent(player);
  return getAvailableActions(state, player).map((action) => {
    const nextState = applyAction(state, action, player);
    const nextStateKey = getStateKey(nextState, opponent);
    return {
      action,
      label: describeAction(action),
      repeats: history.has(nextStateKey),
      nextState,
      nextPlayer: opponent,
      nextStateKey
    };
  });
};

const renderActionMenu = (entries: ActionMenuEntry[]): ActionMenuEntry[] => {
  if (!entries.length) {
    console.log("\nNo legal moves appear on your turn right now.");
    return [];
  }
  const available = entries.filter((entry) => !entry.repeats);
  console.log("\nSelect a move from the numbered list below:");
  available.forEach((entry, index) => console.log(`  ${index + 1}. ${entry.label}`));
  const repeats = entries.filter((entry) => entry.repeats);
  if (repeats.length) {
    console.log("\nUnavailable (would repeat a previous position):");
    repeats.forEach((entry) => console.log(`  - ${entry.label}`));
  }
  return available;
};

type HumanMoveResult = {
  action: ActionMenuEntry | null;
  handoffToAi?: boolean;
};

const addStateToHistory = (history: Set<string>, state: GameState, player: Player): void => {
  history.add(getStateKey(state, player));
};

const renderStatus = (state: GameState, current: Player, humanPlayer: Player): void => {
  clearScreen();
  console.log("TicTacTwo CLI — Moveable grid variant with Minimax AI\n");
  console.log(renderBoard(state));
  console.log(
    `Players: ${FIRST_PLAYER} (first player with ${FIRST_PLAYER_PIECES} pieces) vs ${SECOND_PLAYER} (second).`
  );
  const humanRole =
    humanPlayer === FIRST_PLAYER ? "You are first (X)" : "You are second (O, so X starts).";
  console.log(humanRole);
  console.log(`Each player places up to ${FIRST_PLAYER_PIECES} pieces before moving existing pegs.`);
  console.log(`\n${describeActiveGrid(state)}`);
  const nextActor = current === humanPlayer ? "You" : "AI";
  console.log(`${nextActor} (${current}) are next.`);
  console.log(`\n${renderHelp()}`);
  renderMoveHistory();
};

const renderEngineEvaluation = (
  state: GameState,
  player: Player,
  label: string
): void => {
  if (multiPvCount <= 0) {
    return;
  }
  const evaluations = getEngineEvaluations(state, player, engineDepth, multiPvCount);
  if (!evaluations.length) {
    return;
  }
  console.log(`\n${label} engine evaluation (depth ${engineDepth}):`);
  evaluations.forEach((entry, index) => {
    const scoreText = entry.score >= 0 ? `+${entry.score}` : `${entry.score}`;
    console.log(`  ${index + 1}. score ${scoreText} | PV: ${formatPrincipalVariation(entry.pv)}`);
  });
};

const handleHumanMove = async (
  state: GameState,
  humanPlayer: Player,
  history: Set<string>
): Promise<HumanMoveResult> => {
  const entries = buildActionMenu(state, humanPlayer, history);
  let actionableEntries: ActionMenuEntry[] = [];
  let showMenu = true;

  while (true) {
    if (showMenu) {
      actionableEntries = renderActionMenu(entries);
      if (!entries.length) {
        console.log("\nNo actions remain; type 'restart' to start over or 'ai' to let the engine move.");
      } else if (!actionableEntries.length) {
        console.log(
          "\nEvery legal move would recreate a position you've seen before. Use 'ai' to hand this turn over or 'restart' to begin again."
        );
      }
      showMenu = false;
    }

    const rawInput = await prompt("Select a move number or type a command (ai/restart/exit): ");
    const normalized = rawInput.trim().toLowerCase();

    if (normalized === "exit" || normalized === "quit" || normalized === "q") {
      rl.close();
      process.exit(0);
    }

    if (normalized === "restart" || normalized === "r") {
      return { action: null };
    }

    if (isAiHandOffCommand(rawInput)) {
      console.log("\nHanding this turn to the AI...");
      await sleep(400);
      return { action: null, handoffToAi: true };
    }

    if (!actionableEntries.length) {
      console.log("\nNo numbered options are available right now; please use ai/restart/exit.");
      await sleep(400);
      continue;
    }

    const selection = Number(normalized);
    if (!Number.isNaN(selection) && Number.isInteger(selection)) {
      if (selection >= 1 && selection <= actionableEntries.length) {
        return { action: actionableEntries[selection - 1] };
      }
    }

    console.log("\nSelection out of range. Pick one of the listed move numbers or use ai/restart/exit.");
    await sleep(400);
    showMenu = true;
  }
};

const promptForPlayerChoice = async (): Promise<Player | "SELF_PLAY"> => {
  while (true) {
    const rawChoice = await prompt(
      "Choose your mode — X, O, or Computer-vs-Computer (enter C). X always moves first; selecting O lets the AI open as X. [default X]: "
    );
    const choice = parseStartupChoice(rawChoice);
    if (choice) {
      return choice;
    }
    console.log("\nPlease enter X, O, or C to start the requested mode.");
    await sleep(400);
  }
};

const executeAiTurn = (
  state: GameState,
  player: Player
): GameState => {
  renderEngineEvaluation(state, player, "AI");
  console.log("\nAI is thinking...");
  const aiAction = chooseBestAction(state, player, engineDepth);
  const nextState = applyAction(state, aiAction, player);
  recordMove(player, aiAction);
  return nextState;
};

async function playHumanMatch(humanPlayer: Player): Promise<void> {
  let state = createInitialState();
  let currentPlayer: Player = FIRST_PLAYER;
  const seenStates = new Set<string>();
  addStateToHistory(seenStates, state, currentPlayer);

  while (true) {
    renderStatus(state, currentPlayer, humanPlayer);

    const winner = getWinner(state);
    if (winner || isDraw(state)) {
      break;
    }

    if (currentPlayer === humanPlayer) {
      const { action, handoffToAi } = await handleHumanMove(state, humanPlayer, seenStates);
      if (handoffToAi) {
        const nextState = executeAiTurn(state, currentPlayer);
        const nextPlayer = getOpponent(currentPlayer);
        state = nextState;
        currentPlayer = nextPlayer;
        addStateToHistory(seenStates, state, currentPlayer);
        continue;
      }
      if (!action) {
        return runInteractiveMatch();
      }
      recordMove(humanPlayer, action.action);
      state = action.nextState;
      currentPlayer = action.nextPlayer;
      addStateToHistory(seenStates, state, currentPlayer);
    } else {
      const nextState = executeAiTurn(state, currentPlayer);
      const nextPlayer = getOpponent(currentPlayer);
      state = nextState;
      currentPlayer = nextPlayer;
      addStateToHistory(seenStates, state, currentPlayer);
    }
  }

  renderStatus(state, currentPlayer, humanPlayer);
  const matchWinner = getWinner(state);
  if (matchWinner) {
    if (matchWinner === humanPlayer) {
      console.log("\n🎉 You created three in a row in the active grid! You win.");
    } else {
      console.log("\n💻 AI formed the line. Try shifting smarter next time.");
    }
  } else {
    console.log("\n🤝 It's a draw. The grid is full and no line emerged.");
  }

  const playAgain = await prompt("\nPlay again? (Y/n): ");
  if (playAgain.toLowerCase().startsWith("n")) {
    rl.close();
    process.exit(0);
  }
  return runInteractiveMatch();
}

async function runInteractiveMatch(): Promise<void> {
  const choice = await promptForPlayerChoice();
  if (choice === "SELF_PLAY") {
    return playSelfMatch();
  }
  return playHumanMatch(choice);
}

const playSelfMatch = async (): Promise<void> => {
  let state = createInitialState();
  let currentPlayer: Player = FIRST_PLAYER;
  const seenStates = new Set<string>();
  addStateToHistory(seenStates, state, currentPlayer);

  while (true) {
    clearScreen();
    console.log("Self-play mode (AI vs AI)\n");
    console.log(renderBoard(state));
    console.log(describeActiveGrid(state));
    console.log(`Next to move: ${currentPlayer}`);

    const winner = getWinner(state);
    if (winner || isDraw(state)) {
      break;
    }

    renderEngineEvaluation(state, currentPlayer, `Player ${currentPlayer}`);
    console.log("\nAI selecting move...");
    const aiAction = chooseBestAction(state, currentPlayer, engineDepth);
    console.log(`${currentPlayer} executes ${describeAction(aiAction)}\n`);
    state = applyAction(state, aiAction, currentPlayer);
    recordMove(currentPlayer, aiAction);
    currentPlayer = getOpponent(currentPlayer);
    addStateToHistory(seenStates, state, currentPlayer);
    await sleep(600);
  }

  clearScreen();
  console.log("Self-play mode (AI vs AI) — match complete\n");
  console.log(renderBoard(state));
  const matchWinner = getWinner(state);
  if (matchWinner) {
    console.log(`Player ${matchWinner} wins the self-play match.`);
  } else {
    console.log("Self-play match ended in a draw.");
  }
  rl.close();
  process.exit(0);
};

const main = async () => {
  try {
    if (selfPlayMode) {
      await playSelfMatch();
    } else {
      await runInteractiveMatch();
    }
  } catch (error) {
    console.error("Something unexpected happened:\n", error);
  }
};

main();
