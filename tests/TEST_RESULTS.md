# Test Results

- `npm run test` (2026-02-06 12:19 EST): the 26-node `--test` cases pass, covering the core rule enforcement plus the new diagonal grid shifts, CLI helpers, and the Minimax reasoning/engine-report expectations.
- `npm run coverage` (2026-02-06 11:35 EST): `c8 --reporter=text --reporter=html npm run test` ran the 21-test suite (covering game rules, Minimax reasoning, and the new CLI startup/AI hand-off helpers) and reported 96.2% statements, 94.28% branches, 100% functions, and 96.2% lines; the HTML summary lives under `coverage/index.html`.
- `npm run test` (2026-02-06 11:35 EST): the 21-node `--test` cases pass, covering rule enforcement, Minimax tactics, PV tracking, and the new CLI parsing plus AI hand-off helpers.
- Manual playthrough (2026-02-06 11:30 EST): `NO_CLEAR_SCREEN=1 npm run play`, played a short interactive match, then ran `npm run play -- --self-play` to watch the AI describe each move and report score/PV lines. The CLI stayed within the active grid constraints and printed the new engine reports without crashing.
