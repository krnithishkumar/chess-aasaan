import { Chess } from 'chess.js';
import { userMoves } from './analyze';
import type { AnalyzedGame, MoveRecord, QuizAttempt, QuizCard } from './types';

const DAY = 86400_000;
/** Leitner box intervals in days. */
const INTERVALS = [0, 1, 3, 7, 21, 60];

export function cardId(gameId: string, ply: number) {
  return `${gameId}:${ply}`;
}

/** Every mistake/blunder you made becomes a card; existing progress is kept. */
export function syncCards(games: AnalyzedGame[], cards: Record<string, QuizCard>): Record<string, QuizCard> {
  const next = { ...cards };
  for (const g of games)
    for (const m of userMoves(g)) {
      if (m.severity !== 'mistake' && m.severity !== 'blunder') continue;
      if (!m.evalBefore.best) continue;
      const id = cardId(g.id, m.ply);
      if (!next[id]) next[id] = { id, gameId: g.id, ply: m.ply, box: 0, due: 0, attempts: [] };
    }
  return next;
}

export function dueCards(cards: Record<string, QuizCard>, now = Date.now()): QuizCard[] {
  return Object.values(cards)
    .filter((c) => c.due <= now)
    .sort((a, b) => a.box - b.box || a.due - b.due);
}

export function grade(card: QuizCard, attempt: QuizAttempt): QuizCard {
  const box = attempt.grade === 'got' ? Math.min(card.box + 1, INTERVALS.length - 1) : attempt.grade === 'partial' ? card.box : 0;
  return { ...card, box, due: attempt.at + INTERVALS[box] * DAY, attempts: [...card.attempts, attempt] };
}

/** Parse "Nf3, Bxe5 e4" (SAN or UCI) into legal moves for the position. */
export function parseCandidates(fen: string, text: string): { san: string; uci: string }[] {
  const out: { san: string; uci: string }[] = [];
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    const c = new Chess(fen);
    try {
      const clean = tok.replace(/^\d+\.+/, '');
      const m = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(clean)
        ? c.move({ from: clean.slice(0, 2), to: clean.slice(2, 4), promotion: clean[4] })
        : c.move(clean);
      const uci = m.from + m.to + (m.promotion ?? '');
      if (!out.some((x) => x.uci === uci)) out.push({ san: m.san, uci });
    } catch {
      /* illegal or unparseable token: ignored, shown back to the user */
    }
  }
  return out;
}

export function findMove(games: AnalyzedGame[], card: QuizCard): { game: AnalyzedGame; move: MoveRecord } | undefined {
  const game = games.find((g) => g.id === card.gameId);
  const move = game?.moves[card.ply];
  return game && move ? { game, move } : undefined;
}
