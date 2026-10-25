# Chess Aasaan: instructions for Claude

## Git: always commit and push
After every change to this repo (code, styles, docs, config), before ending the turn:
1. `npm run build` must pass. Don't commit a broken build.
2. `git add -A && git commit` with a short, descriptive message.
3. `git push` to `origin` on the current branch.

The user has given standing permission for this. No need to ask. If the push fails, say so plainly with the error.

## Product direction
- A serious training tool for an adult improver (~2100 chess.com rapid, no coach). Calm and clear enough that a kid could use it, but no gimmicks: no countdowns, XP, levels, streak flames or badges.
- Every recommendation must come from established training practice (see `src/lib/curriculum.ts`) or from Stockfish numbers on the user's own games. Engine output is the only truth. Never invent positions or evals.
