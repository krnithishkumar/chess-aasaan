# Chess Aasaan

Personal chess coach for nithish_ravi: fetches chess.com games, analyzes them with Stockfish 18 in the browser, tags every mistake, tracks patterns and quizzes you on your own positions.

```
npm install
npm run dev     # http://localhost:5173
```

## How it works

- **Fetch**: chess.com public API (`/pub/player/{user}/games/archives`). Past months are cached in IndexedDB; the current month is refetched.
- **Analyze**: Stockfish 18 lite (WASM, single-threaded, `public/stockfish/`) evaluates every position at the configured depth (default 16, ~8s per game). Engine output is the only source of truth.
- **Classify**: win%-loss per move (lichess model): inaccuracy >= 5, mistake >= 10, blunder >= 15 points.
- **Tag** (`src/lib/analyze.ts`, `autoTag`), heuristic, and you can override them per mistake:
  - `time trouble`: clock after the move < max(30s, 10% of base)
  - `opening`: move <= 12; `endgame`: <= 6 non-pawn pieces on the board
  - `calculation`: you played a forcing move that fails, or a quiet blunder
  - `tactic missed`: engine best was forcing, or you allowed a forcing reply
  - `positional`: everything else
- **Patterns**: errors per tag, trend (last 10 vs older), centipawn loss by move number (stamina), clock checkpoints, opening leaks, then "train next" drills.
- **Quiz**: every mistake/blunder becomes a Leitner card. Write a plan and candidate moves first; on reveal, each candidate is evaluated by Stockfish.
- **Copy for Claude coach**: exports the game (or patterns) with engine evals and tags plus your coaching rules, ready to paste into Claude.
