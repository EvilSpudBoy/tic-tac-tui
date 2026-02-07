# TicTacTwo (Movable Grid Variant)

A terminal-based implementation of [**Tic-Tac-Two**](https://gamescrafters.berkeley.edu/games.php?game=tictactwo), the board-game variant where a 3×3 tic-tac-toe grid slides around a 5×5 board while players place X/O pegs inside the active area.

## Highlights

- **Moveable grid:** The active 3×3 window can shift orthogonally or diagonally across the 5×5 board, and winning lines are only checked inside that window.
- **Piece limit & movement:** Each player has exactly four markers; once you place them all you must move an existing peg inside the active grid, and the CLI keeps a move history so you can review the sequence mid-match.
- **Fixed player order:** X is always the first player with four pieces and opens the match; O plays second, but you can choose whether to control X, control O (letting the AI still open as X), or hand the whole match to the computer through the interactive Computer-vs-Computer prompt at startup.
- **Minimax AI with alpha-beta pruning:** A depth-limited Minimax engine with full alpha-beta pruning, a transposition table for caching evaluated positions, and move-ordering heuristics that prioritise centre placements. The engine displays iterative-deepening progress as it thinks, and reports transposition-table hits and cutoff counts alongside the evaluation.
- **Full-screen interactive TUI:** The terminal renders a full-screen interface with a colour-coded board, a compact status bar, an engine evaluation widget that updates in-place during AI thinking, a scrollable move history, and a raw-mode cycling move selector (Tab/↑↓ to browse, type to filter, Enter to confirm).
- **Repetition avoidance:** The engine tracks every previously seen board+active-grid configuration and marks moves that would recreate one as unavailable, so only fresh positions can be chosen.

## Rules Overview

X is always the first player with four pieces, O plays second, and the CLI enforces that order—choose either marker at launch, but X takes the opening move every time.

1. The board is 5 rows (A–E) by 5 columns (1–5). Only the currently active 3×3 grid—visible in brackets on the board—can receive new markers.
2. On your turn you may either place a marker inside the active grid or shift the grid one cell in any adjacent direction (including diagonals) if space allows.
3. Each player must place at least two markers before shifting the grid or moving a previously placed peg.
4. Everyone only has four markers—after you place the fourth peg, you cannot place any more and must move one of your existing pieces into an empty slot inside the active grid.
5. Only three-in-a-row lines **fully contained in the active grid** count. If your marker completes such a line, you win; otherwise play continues.
6. If all cells fill without a valid line, the game is a draw.
7. Each turn must avoid recreating any previously seen board layout (including the active grid and whose turn it is); repeat candidates show up as "unavailable" in the move selector.

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

At startup you choose to play as X, as O (letting the AI open as X), or Computer-vs-Computer self-play. X always moves first, but choosing O means the AI opens.

- **Move selector:** Use **Tab** or **↑/↓** to cycle through every legal action (placements, moves, and shifts). Type to filter the list. Press **Enter** to confirm the highlighted move.
- **Move history:** Use **PgUp/PgDn** to scroll through the move-history window beneath the board.
- **Commands:** Type `ai` (or `auto`) to hand the current turn to the engine, `restart` (or `r`) to begin a new match, or `exit`/`quit`/`q` to leave.
- Placement limits, movement minimums, and active-grid bounds are all enforced automatically—only valid options appear in the selector.
- Moves that would recreate a previously seen position are shown as unavailable.

## Engine Reports & Self-play

Every AI decision surfaces a short engine report. The CLI prints the score (in the Minimax utility function scale) alongside a principal variation (PV) string, and it can list multiple PVs in descending score order. Tune the output with:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--multi-pv=<count>` | 3 | Number of PV lines to display |
| `--engine-depth=<value>` | 6 | Maximum search depth |
| `--eval=<name>` | `default` | Evaluation plugin for both players |
| `--eval-x=<name>` | — | Evaluation plugin for player X only |
| `--eval-o=<name>` | — | Evaluation plugin for player O only |
| `--list-evals` | — | List available evaluation plugins and exit |

During AI thinking, the TUI shows an iterative-deepening progress display that updates in-place with the current depth, node count, transposition-table hits, and cutoff count.

Run `npm run play -- --self-play` or choose Computer-vs-Computer at startup to let the two AI players battle while the CLI narrates each move with the latest evaluation output. Use `--eval-x` and `--eval-o` to pit different strategies against each other (e.g. `--eval-x=positional --eval-o=default`).

## Extensibility & Learning Loop

TicTacTwo exposes the Minimax evaluation layer as a small plugin registry. Use `registerEvaluationPlugin` to drop in custom heuristics (the default engine is re-exported as `DEFAULT_EVALUATION_PLUGIN`, and `listEvaluationPlugins` helps you inspect what is registered). Two built-in plugins are provided:

- **`default`** — Terminal-only scoring: +10−depth for wins, depth−10 for losses, 0 for draws.
- **`positional`** — Scores threats (two-in-a-row with an empty third cell), centre control, and active-grid piece presence in addition to terminal outcomes.

Every move query accepts an evaluation function, so third-party tools can swap in bespoke scoring without touching the core game loop.

The `runSelfPlayEpisode` and `runSelfPlayTraining` helpers wrap the self-play loop, letting you sample episodes, collect histories, and aggregate win/draw/timeout counts while experimenting with different depths or evaluators. This scaffolding is intentionally lightweight so you can plug in logging, data collection, or policy updates without copying the CLI internals.

## Development

- `npm run build` compiles `src/` → `dist/`.
- `NO_CLEAR_SCREEN=1 npm run play` skips terminal clears so you can capture the full board history while manually verifying the variant.
- `npm run play` runs the compiled JavaScript.
- `npm run start` is a convenience script that builds and immediately plays.
- `npm run test` compiles the sources and runs the Node.js built-in test suite (see `tests/TEST_RESULTS.md` for the latest pass).

## Testing

- `npm run test` executes `node --test tests/*.test.js`, covering 26 targeted assertions across four test files:
  - `tests/game.test.js` — Core rules, placement/shift/move enforcement, winner/draw detection, evaluation plugin registry, and self-play training scaffolding.
  - `tests/cli.test.js` — Startup-choice parsing and AI hand-off command detection.
  - `tests/coverage.test.js` — Additional edge-case coverage for diagonal shifts, active-grid helpers, and state-key generation.
  - `tests/repetition.test.js` — Repeated-state detection and avoidance.
  - `tests/minimax-bench.test.js` — Performance benchmarks for the minimax engine, verifying alpha-beta pruning and transposition-table effectiveness.
- `npm run coverage` wraps the test suite with `c8` and produces textual plus HTML reports (`coverage/index.html`).
- Every run writes a summary to `tests/TEST_RESULTS.md` so you can quickly verify which rules the suite exercises and the AI behaviors it protects.

## Structure

- `src/game.ts`: State representation for the 5×5 board, the active grid, legal moves, and helper utilities.
- `src/minimax.ts`: Depth-limited Minimax with alpha-beta pruning, transposition table, and move-ordering heuristics.
- `src/evaluation.ts`: Plugin registry for custom evaluation heuristics (`default` and `positional` built-in).
- `src/tui.ts`: Full-screen terminal rendering — board, status bar, engine-eval widget, scrollable move history, and cycling move selector.
- `src/cli.ts`: Orchestrates the prompt loop, input parsing, AI turns, and iterative-deepening display.
- `src/cli-utils.ts`: Startup-choice parsing and AI hand-off command helpers.
- `src/learning.ts`: Lightweight self-play episode and training scaffolding for extensibility experiments.

Happy gaming! 🎯🧠
