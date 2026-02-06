# TicTacTwo (Movable Grid Variant)

This is an open-source, terminal-based take on **Tic-Tac-Two**: the Marbles: The Brain Store variant where a 3×3 tic-tac-toe grid slides around a 5×5 board while players place X/O pegs inside the active area.

## Highlights

- **Moveable grid:** The active 3×3 window can shift orthogonally or diagonally across the 5×5 board, and winning lines are only checked inside that window.
- **Piece limit & movement:** Each player has exactly four markers; once you place them all you must move an existing peg inside the active grid using a `move` command, and the CLI keeps a move history so you can review the sequence mid-match.
- **Fixed player order:** X is always the first player with four pieces and opens the match; O plays second, but you can choose whether to control X, control O (letting the AI still open as X), or hand the whole match to the computer through the interactive Computer-vs-Computer prompt at startup.
- **Minimax AI:** A depth-limited Minimax player with alpha-beta-style pruning (via repeated-state detection) makes optimal decisions, so the computer will always force a draw or better.
- **TUI-friendly CLI:** The terminal renders the board, highlights the active grid, and echoes the valid controls for placing or shifting.
- **Repetition avoidance:** The CLI tracks every previously seen board+active-grid configuration and marks moves that would recreate one as unavailable so only fresh positions can be chosen.

## Rules Overview

X is always the first player with four pieces, O plays second, and the CLI enforces that order—choose either marker at launch, but X takes the opening move every time.

1. The board is 5 rows (A–E) by 5 columns (1–5). Only the currently active 3×3 grid—visible in brackets on the board—can receive new markers.
2. On your turn you may either place a marker inside the active grid or shift the grid one cell in any adjacent direction (including diagonals) if space allows.
3. Each player must place at least two markers before shifting the grid or moving a previously placed peg.
4. Everyone only has four markers—after you place the fourth peg, you cannot place any more and must move one of your existing pieces into an empty slot inside the active grid (use the `move A1 B2` command).
5. Only three-in-a-row lines **fully contained in the active grid** count. If your marker completes such a line, you win; otherwise play continues.
6. If all cells fill without a valid line, the game is a draw.
7. Each turn must avoid recreating any previously seen board layout (including the active grid and whose turn it is); repeat candidates show up as "unavailable" in the numbered menu.

## Rule Test Mapping

| Rule / Constraint | Representative tests (see `tests/game.test.js`) |
| --- | --- |
| X always opens with four pieces while O follows (you may choose either symbol, but X still moves first). | `X remains the first player with four pieces` |
| Only the active 3×3 window can receive new markers. | `active grid indices stay aligned with the highlighted window`, `placements are constrained to the active grid`, `applyAction rejects placements on occupied cells` |
| You may either place inside the active window or shift it one cell in any adjacent direction when space allows. | `shift actions respect the board edges`, `applyAction prevents shifts outside the board`, `minimax chooses a shift when the active grid is full` |
| Each player must place at least two markers before shifting the grid or moving a previously placed peg. | `shift actions become available only after placing two markers`, `applyAction rejects shifts before the placement minimum` |
| Only lines fully contained in the active grid count as wins. | `winner detection ignores lines outside the active grid`, `winner detection recognizes lines inside the active grid` |
| A filled board without a valid line is a draw. | `draw detection stays false if a winner exists on a full board` |
| Repeating any earlier board+active-grid configuration is forbidden and listed as unavailable in the menu. | `wouldRepeatState detects repeated positions` |

## Quick Start

```bash
cd tic-tac-two
npm install
npm run start   # builds and launches the interactive CLI
```

When the CLI launches it prompts you to choose X, O, or Computer-vs-Computer (self-play) before the match begins; X still opens whenever possible.

Or build once and keep playing:

```bash
npm run build
npm run play
```

For automated engine-vs-engine runs with evaluation logging, use:

```bash
npm run play -- --self-play
```

## Controls

The CLI now prompts you at startup to play as X, play as O (letting the AI open as X), or hand the match to the computer through Computer-vs-Computer self-play. X always moves first, but choosing O means the AI opens. Each turn still reminds you which rows/columns are under the 3×3 window and whether you are first or second.

- The CLI now presents every legal action (placements, moves, and shifts) inside the active 3×3 grid as a numbered menu entry; pick a number to execute the desired move.
- Any candidate that would recreate a previously seen board+active-grid configuration is listed under "Unavailable (would repeat a previous position)" so it cannot be chosen.
- Placement limits, movement minimums, and active-grid bounds are enforced behind the scenes, so you no longer need to type `move A1 B2` or `up`/`down` yourself—the menu only lists valid options.
- Type `ai` (or `auto`) to hand this turn to the engine so you can resume afterward, `restart` (or `r`) to begin a new match, or `exit`/`quit`/`q` to leave.
- A brief move history is still displayed beneath the board so you always have a record of the recent sequence.


## Extensibility & Learning Loop

TicTacTwo now exposes the Minimax evaluation layer as a small plugin registry. Use `registerEvaluationPlugin` to drop in custom heuristics (the default engine is re-exported as `DEFAULT_EVALUATION_PLUGIN`, and `listEvaluationPlugins` helps you inspect what is registered). Every move query accepts an evaluation function, so third-party tools can swap in bespoke scoring without touching the core game loop.

The new `runSelfPlayEpisode` and `runSelfPlayTraining` helpers wrap the self-play loop, letting you sample episodes, collect histories, and aggregate win/draw/timeout counts while experimenting with different depths or evaluators. This scaffolding is intentionally lightweight so you can plug in logging, data collection, or policy updates without copying the CLI internals.

## Engine Reports & Self-play

Every AI decision now surfaces a short engine report. The CLI prints the score (in the Minimax utility function scale) alongside a principal variation (PV) string, and it can list multiple PVs in descending score order. By default it shows three lines, but you can tune the output with the `--multi-pv=<count>` option (`npm run play -- --multi-pv=5`), and you can increase the search depth with `--engine-depth=<value>`.

Run `npm run play -- --self-play` or choose Computer-vs-Computer at startup to let the two AI players battle while the CLI narrates each move with the latest evaluation output. This is helpful for inspecting the Minimax reasoning or verifying tactical sequences without human intervention.

## Development

- `npm run build` compiles `src/` → `dist/`.
- `NO_CLEAR_SCREEN=1 npm run play` skips terminal clears so you can capture the full board history while manually verifying the variant.
- `npm run play` runs the compiled JavaScript.
- `npm run start` is a convenience script that builds and immediately plays.
- `npm run test` compiles the sources and runs the Node.js built-in test suite (see `tests/TEST_RESULTS.md` for the latest pass).

## Testing

- `npm run test` now executes `node --test tests/*.test.js`, covering 24 targeted assertions (including the fixed X-first turn, placement prerequisites, the four-piece move rule, active-grid enforcement, AI evaluations, and the CLI startup/AI hand-off helpers).
- `npm run coverage` wraps the test suite with `c8` and produces textual plus HTML reports (coverage/index.html). The latest run reports 96.2% statements, 94.28% branches, 100% functions, and 96.2% lines across the compiled code while exercising the 21-test suite.
- Every run writes a summary to `tests/TEST_RESULTS.md` so you can quickly verify which rules the suite exercises and the AI behaviors it protects.
- `tests/game.test.js` now also validates the evaluation plugin registry and self-play training scaffolding so you can see the extensibility hooks in action.

## Structure

- `src/game.ts`: State representation for the 5×5 board, the active grid, legal moves, and helper utilities.
- `src/minimax.ts`: Recursive Minimax that tracks visited states to avoid loops while exploring placements/shifts.
- `src/tui.ts`: Terminal rendering utilities that highlight the active 3×3 window.
- `src/cli.ts`: Orchestrates the prompt loop, input parsing, and AI turns.
- `src/evaluation.ts`: Plugin registry for custom evaluation heuristics.
- `src/learning.ts`: Lightweight self-play episode and training scaffolding for extensibility experiments.

Happy gaming! 🎯🧠
