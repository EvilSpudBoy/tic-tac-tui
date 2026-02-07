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
import {
  clearScreen,
  renderBoard,
  renderStatusBar,
  renderEvalWidget,
  renderMoveHistoryWindow,
  renderMoveSelectorLine,
  renderHelp,
  EvalWidgetData,
  HISTORY_WINDOW_SIZE,
  BOLD,
  RESET,
  DIM
} from "./tui";
import { parseStartupChoice, isAiHandOffCommand } from "./cli-utils";
import { getEvaluationPlugin, listEvaluationPlugins } from "./evaluation";

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
const MAX_MOVE_HISTORY = 50;

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
      const dirKey = `${action.dx},${action.dy}`;
      return `shift ${directionLabels[dirKey] || `dx ${action.dx}, dy ${action.dy}`}`;
    }
  }
};

const recordMove = (player: Player, action: Action): void => {
  moveHistory.unshift(`[${player}] ${describeAction(action)}`);
  if (moveHistory.length > MAX_MOVE_HISTORY) moveHistory.pop();
};

const args = process.argv.slice(2);
const parseNumericArg = (flag: string, defaultValue: number): number => {
  const entry = args.find((item) => item.startsWith(`${flag}=`));
  if (!entry) return defaultValue;
  const [, value] = entry.split("=");
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const engineDepth = parseNumericArg("--engine-depth", 6);
const multiPvCount = parseNumericArg("--multi-pv", 3);
const selfPlayMode = args.includes("--self-play");

const parseStringArg = (flag: string): string | undefined => {
  const entry = args.find((item) => item.startsWith(`${flag}=`));
  if (!entry) return undefined;
  return entry.split("=")[1];
};

const evalXPlugin = getEvaluationPlugin(parseStringArg("--eval-x") ?? parseStringArg("--eval"));
const evalOPlugin = getEvaluationPlugin(parseStringArg("--eval-o") ?? parseStringArg("--eval"));

if (args.includes("--list-evals")) {
  console.log("Available evaluation plugins:");
  for (const p of listEvaluationPlugins()) {
    console.log(`  ${BOLD}${p.name}${RESET} — ${p.description}`);
  }
  process.exit(0);
}

const describeActiveGrid = (state: GameState): string => {
  const [rowStart, rowEnd, colStart, colEnd] = getActiveCellCoordinates(state);
  const rows = rowLabels.slice(rowStart, rowEnd + 1).join("-");
  return `Active grid rows ${rows}, cols ${colStart + 1}-${colEnd + 1}`;
};

const formatPrincipalVariation = (pv: Action[]): string => {
  if (!pv.length) return "<none>";
  return pv.map(describeAction).join(" → ");
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- Action menu ---

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

type HumanMoveResult = {
  action: ActionMenuEntry | null;
  handoffToAi?: boolean;
};

const addStateToHistory = (history: Set<string>, state: GameState, player: Player): void => {
  history.add(getStateKey(state, player));
};

// --- Eval helpers ---

const computeEvalData = (
  state: GameState,
  player: Player,
  history: Set<string>
): EvalWidgetData | null => {
  if (multiPvCount <= 0) return null;
  const evalPlugin = player === "X" ? evalXPlugin : evalOPlugin;
  const { evaluations, stats } = getEngineEvaluations(state, player, history, engineDepth, multiPvCount, evalPlugin.evaluate);
  if (!evaluations.length) return null;
  return {
    evaluations: evaluations.map((e) => ({
      score: e.score,
      pvText: formatPrincipalVariation(e.pv)
    })),
    depth: engineDepth,
    maxDepth: engineDepth,
    nodesVisited: stats.nodesVisited,
    cacheHits: stats.cacheHits,
    cutoffs: stats.cutoffs,
    evalName: evalPlugin.name
  };
};

// --- Full-screen render ---

let historyOffset = 0;

const renderFullScreen = (
  state: GameState,
  current: Player,
  humanPlayer: Player,
  evalData: EvalWidgetData | null,
  selectorLine: string | null
): void => {
  clearScreen();
  console.log(renderStatusBar(state, current, humanPlayer));
  console.log();
  console.log(renderBoard(state));

  if (evalData) {
    console.log();
    console.log(renderEvalWidget(evalData));
  }

  if (moveHistory.length) {
    console.log();
    console.log(renderMoveHistoryWindow(moveHistory, historyOffset));
  }

  if (selectorLine) {
    console.log();
    process.stdout.write(selectorLine);
  }
};

// --- Progressive engine eval (iterative deepening display) ---

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const renderProgressiveEval = async (
  state: GameState,
  player: Player,
  history: Set<string>
): Promise<void> => {
  if (multiPvCount <= 0) return;

  const evalPlugin = player === "X" ? evalXPlugin : evalOPlugin;
  let prevLineCount = 0;

  for (let depth = 1; depth <= engineDepth; depth++) {
    // Yield to let the event loop process signals (e.g. Ctrl+C)
    await yieldToEventLoop();

    const { evaluations, stats } = getEngineEvaluations(state, player, history, depth, multiPvCount, evalPlugin.evaluate);

    const evalData: EvalWidgetData = {
      evaluations: evaluations.map((e) => ({
        score: e.score,
        pvText: formatPrincipalVariation(e.pv)
      })),
      depth,
      maxDepth: engineDepth,
      nodesVisited: stats.nodesVisited,
      cacheHits: stats.cacheHits,
      cutoffs: stats.cutoffs,
      evalName: evalPlugin.name
    };

    // Overwrite previous eval block
    if (prevLineCount > 0) {
      process.stdout.write(`\x1b[${prevLineCount}A`);
      for (let i = 0; i < prevLineCount; i++) {
        process.stdout.write(`\x1b[K\n`);
      }
      process.stdout.write(`\x1b[${prevLineCount}A`);
    }

    const rendered = renderEvalWidget(evalData);
    console.log(rendered);
    prevLineCount = rendered.split("\n").length;
  }
};

// --- Raw-mode cycling move selector ---

const selectMove = async (
  state: GameState,
  humanPlayer: Player,
  history: Set<string>
): Promise<HumanMoveResult> => {
  const entries = buildActionMenu(state, humanPlayer, history);
  const available = entries.filter((e) => !e.repeats);

  // Compute engine eval for display
  const evalData = computeEvalData(state, humanPlayer, history);

  if (!available.length) {
    renderFullScreen(state, humanPlayer, humanPlayer, evalData, null);
    if (!entries.length) {
      console.log("\nNo legal moves available.");
    } else {
      console.log("\nAll moves repeat previous positions.");
    }
    const input = await prompt("Command (ai/restart/exit): ");
    const cmd = input.toLowerCase();
    if (cmd === "exit" || cmd === "quit" || cmd === "q") {
      rl.close();
      process.exit(0);
    }
    if (isAiHandOffCommand(input)) return { action: null, handoffToAi: true };
    return { action: null };
  }

  let selectedIndex = 0;
  let filterText = "";
  historyOffset = 0;

  const getFiltered = (): ActionMenuEntry[] => {
    if (!filterText) return available;
    const lower = filterText.toLowerCase();
    return available.filter((e) => e.label.toLowerCase().includes(lower));
  };

  const clampIndex = (filtered: ActionMenuEntry[]): void => {
    if (!filtered.length) return;
    if (selectedIndex >= filtered.length) selectedIndex = filtered.length - 1;
    if (selectedIndex < 0) selectedIndex = 0;
  };

  const buildSummary = (): string => {
    const placeCount = available.filter((e) => e.action.type === "place").length;
    const moveCount = available.filter((e) => e.action.type === "move").length;
    const shiftCount = available.filter((e) => e.action.type === "shift").length;
    const parts: string[] = [];
    if (placeCount) parts.push(`${placeCount} place`);
    if (moveCount) parts.push(`${moveCount} move`);
    if (shiftCount) parts.push(`${shiftCount} shift`);
    return `${DIM}${available.length} moves (${parts.join(" · ")})${RESET}`;
  };

  const redraw = (): void => {
    const filtered = getFiltered();
    clampIndex(filtered);
    const current = filtered[selectedIndex] || null;
    const selector = renderMoveSelectorLine(current, selectedIndex, filtered.length, filterText);
    const summary = buildSummary();
    renderFullScreen(state, humanPlayer, humanPlayer, evalData, `${summary}\n${selector}`);
  };

  // Fallback for non-TTY
  if (!process.stdin.isTTY) {
    redraw();
    console.log("\n\nAvailable moves:");
    available.forEach((e, i) => console.log(`  ${i + 1}. ${e.label}`));
    const input = await prompt("Select move number or command: ");
    const cmd = input.toLowerCase();
    if (cmd === "exit" || cmd === "quit" || cmd === "q") {
      rl.close();
      process.exit(0);
    }
    if (cmd === "restart" || cmd === "r") return { action: null };
    if (isAiHandOffCommand(input)) return { action: null, handoffToAi: true };
    const num = Number(cmd);
    if (!isNaN(num) && num >= 1 && num <= available.length) {
      return { action: available[num - 1] };
    }
    return { action: null };
  }

  // Raw-mode keypress handler
  return new Promise<HumanMoveResult>((resolve) => {
    rl.pause();
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const cleanup = (): void => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      rl.resume();
    };

    const onData = (data: Buffer): void => {
      const key = data.toString();

      // Ctrl+C
      if (key === "\x03") {
        cleanup();
        rl.close();
        process.exit(0);
      }

      // Up arrow or Shift+Tab — cycle backward
      if (key === "\x1b[A" || key === "\x1b[Z") {
        selectedIndex--;
        const filtered = getFiltered();
        if (selectedIndex < 0) selectedIndex = filtered.length - 1;
        redraw();
        return;
      }

      // Down arrow or Tab — cycle forward
      if (key === "\x1b[B" || key === "\t") {
        selectedIndex++;
        const filtered = getFiltered();
        if (selectedIndex >= filtered.length) selectedIndex = 0;
        redraw();
        return;
      }

      // PageUp — scroll history up
      if (key === "\x1b[5~") {
        historyOffset = Math.max(0, historyOffset - HISTORY_WINDOW_SIZE);
        redraw();
        return;
      }

      // PageDown — scroll history down
      if (key === "\x1b[6~") {
        const maxOffset = Math.max(0, moveHistory.length - HISTORY_WINDOW_SIZE);
        historyOffset = Math.min(maxOffset, historyOffset + HISTORY_WINDOW_SIZE);
        redraw();
        return;
      }

      // Enter — confirm selection
      if (key === "\r" || key === "\n") {
        const filtered = getFiltered();
        clampIndex(filtered);
        if (filtered[selectedIndex]) {
          cleanup();
          resolve({ action: filtered[selectedIndex] });
        }
        return;
      }

      // Backspace
      if (key === "\x7f" || key === "\b") {
        if (filterText.length > 0) {
          filterText = filterText.slice(0, -1);
          selectedIndex = 0;
          redraw();
        }
        return;
      }

      // Printable character — add to filter / check for commands
      if (key.length === 1 && key >= " " && key <= "~") {
        filterText += key;
        selectedIndex = 0;

        const cmd = filterText.trim().toLowerCase();
        if (cmd === "ai" || cmd === "auto") {
          cleanup();
          resolve({ action: null, handoffToAi: true });
          return;
        }
        if (cmd === "restart") {
          cleanup();
          resolve({ action: null });
          return;
        }
        if (cmd === "exit" || cmd === "quit") {
          cleanup();
          rl.close();
          process.exit(0);
        }

        redraw();
        return;
      }
    };

    process.stdin.on("data", onData);
    redraw();
  });
};

// --- Game flow ---

const promptForPlayerChoice = async (): Promise<Player | "SELF_PLAY"> => {
  while (true) {
    const rawChoice = await prompt(
      "Choose your mode — X, O, or Computer-vs-Computer (C). [default X]: "
    );
    const choice = parseStartupChoice(rawChoice);
    if (choice) return choice;
    console.log("\nPlease enter X, O, or C.");
    await sleep(400);
  }
};

const executeAiTurn = async (
  state: GameState,
  player: Player,
  humanPlayer: Player,
  history: Set<string>
): Promise<GameState> => {
  clearScreen();
  console.log(renderStatusBar(state, player, humanPlayer));
  console.log();
  console.log(renderBoard(state));

  if (moveHistory.length) {
    console.log();
    console.log(renderMoveHistoryWindow(moveHistory, 0));
  }

  console.log(`\n${BOLD}AI is thinking...${RESET}\n`);
  await renderProgressiveEval(state, player, history);

  const evalPlugin = player === "X" ? evalXPlugin : evalOPlugin;
  const aiAction = chooseBestAction(state, player, history, engineDepth, evalPlugin.evaluate);
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
    const winner = getWinner(state);
    if (winner || isDraw(state)) {
      renderFullScreen(state, currentPlayer, humanPlayer, null, null);
      if (winner) {
        if (winner === humanPlayer) {
          console.log("\n🎉 You created three in a row! You win!");
        } else {
          console.log("\n💻 AI formed the line. Better luck next time!");
        }
      } else {
        console.log("\n🤝 Draw. No line emerged.");
      }
      break;
    }

    if (currentPlayer === humanPlayer) {
      const { action, handoffToAi } = await selectMove(state, humanPlayer, seenStates);
      if (handoffToAi) {
        const nextState = await executeAiTurn(state, currentPlayer, humanPlayer, seenStates);
        currentPlayer = getOpponent(currentPlayer);
        state = nextState;
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
      const nextState = await executeAiTurn(state, currentPlayer, humanPlayer, seenStates);
      currentPlayer = getOpponent(currentPlayer);
      state = nextState;
      addStateToHistory(seenStates, state, currentPlayer);
    }
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
  if (choice === "SELF_PLAY") return playSelfMatch();
  return playHumanMatch(choice);
}

const playSelfMatch = async (): Promise<void> => {
  let state = createInitialState();
  let currentPlayer: Player = FIRST_PLAYER;
  const seenStates = new Set<string>();
  addStateToHistory(seenStates, state, currentPlayer);

  while (true) {
    clearScreen();
    console.log(`${BOLD}Self-play mode (AI vs AI)${RESET}`);
    console.log();
    console.log(renderBoard(state));
    console.log(describeActiveGrid(state));

    if (moveHistory.length) {
      console.log();
      console.log(renderMoveHistoryWindow(moveHistory, 0));
    }

    console.log(`\nNext to move: ${currentPlayer}`);

    const winner = getWinner(state);
    if (winner || isDraw(state)) break;

    console.log(`\n${BOLD}AI selecting move...${RESET}\n`);
    await renderProgressiveEval(state, currentPlayer, seenStates);

    const evalPlugin = currentPlayer === "X" ? evalXPlugin : evalOPlugin;
    const aiAction = chooseBestAction(state, currentPlayer, seenStates, engineDepth, evalPlugin.evaluate);
    console.log(`\n${currentPlayer} executes ${describeAction(aiAction)}`);
    state = applyAction(state, aiAction, currentPlayer);
    recordMove(currentPlayer, aiAction);
    currentPlayer = getOpponent(currentPlayer);
    addStateToHistory(seenStates, state, currentPlayer);
    await sleep(600);
  }

  clearScreen();
  console.log(`${BOLD}Self-play mode — match complete${RESET}\n`);
  console.log(renderBoard(state));
  const matchWinner = getWinner(state);
  if (matchWinner) {
    console.log(`Player ${matchWinner} wins.`);
  } else {
    console.log("Draw.");
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
