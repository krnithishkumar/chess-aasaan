# Chess Aasaan

A serious, calm training site for improving at long (classical) games without a coach. It fetches your chess.com games, checks them with Stockfish 18 in the browser, and turns them into a daily training plan built on established coaching practice.

```
npm install
npm run dev     # http://localhost:5173
```

## The method (`src/lib/curriculum.ts`, explained on "The method" page)

1. **Serious solo study** is the strongest predictor of playing strength (Charness et al. 2005). The daily plan is mostly that.
2. **The same 5-step check every move** (Heisman's "Real Chess", Kotov's candidate moves): what changed, forcing moves, candidates, calculate, blunder check.
3. **Review your own games before the engine** (Dvoretsky & Yusupov). Mark the turning points yourself, then compare.
4. **A time plan for 90+30**, with checkpoints at moves 20, 30 and 40.
5. **Daily blocks**: tactics, calculation, endgames, review, long games, openings. Your two weakest areas (from your games) get 25% more time.

No countdowns, XP, levels or streaks. Progress is measured by Stockfish's verdict on your games.

## Pages

- **Today**: the session for today in blocks, with buttons into the in-app tools and ticks for off-screen work (books, long games). What your games say, your rules, games waiting for review.
- **My games**: fetch from chess.com and analyse (Stockfish 18 lite WASM, depth 16 default).
- **Game review**, in 3 steps: (1) your analysis with the engine hidden: mark turning points and write what you thought; (2) compare: "you found X of Y" against the engine's swings, then the mistakes with tags you can correct; (3) one rule, collected on Today.
- **On the board**: in game review (after your own analysis) every move gets a badge on its square (Best ★, Excellent !, Good ✓, Inaccuracy ?!, Mistake ?, Blunder ??) and a one-line insight above the board, with a "Show best move" toggle. Drill attempts get the same badge.
- **Sounds**: soft synthesized move, capture and check sounds plus drill feedback (`src/lib/sound.ts`, Web Audio, no sound files). Can be turned off in Settings.
- **Drills**: every mistake or blunder becomes a spaced-repetition position (1, 3, 7, 21, 60 days).
  - *Mistake drills*: find the move you should have played, 3 tries; a move within 3 win% of best counts.
  - *Think trainer*: the 5-step check written out, your choice and every candidate checked by Stockfish and graded automatically.
- **Progress**: training log for the week, errors per game over time, strengths and weaknesses, clock against the time plan, mistake types, missed tactics, conversion, late-game accuracy, time of day, games in a row, openings.
- **The method**: the training approach in plain language, books, glossary and sources.

## Engine details

- Classification is win%-loss per move (lichess model): inaccuracy >= 5, mistake >= 10, blunder >= 15 points.
- Auto tags (`autoTag` in `src/lib/analyze.ts`) are heuristics; correct them in game review: time trouble, opening, endgame, calculation, tactic missed, positional.
- Everything is stored in this browser (IndexedDB). **Copy for Claude** exports a game or your patterns with engine evals for a coaching chat.
