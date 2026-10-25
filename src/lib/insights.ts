import { evalToCp, userMoves, winPct } from './analyze';
import { type Theme, themesOf } from './themes';
import type { AnalyzedGame, MoveRecord, Tag } from './types';
import { tagsOf } from './types';

const W = { inaccuracy: 0, mistake: 1, blunder: 2 } as const;
const serious = (m: MoveRecord) => m.severity === 'mistake' || m.severity === 'blunder';
const weight = (m: MoveRecord) => (m.severity ? W[m.severity] : 0);
const errorsPerGame = (g: AnalyzedGame) => userMoves(g).reduce((a, m) => a + weight(m), 0);
const toScore = (ratePer100: number) => Math.round(100 * Math.exp(-ratePer100 / 10));

export interface DnaAxis {
  key: string;
  label: string;
  score: number;
  detail: string;
}

/** Your skill profile, 0-100. Relative to your own error rates, not a rating. */
export function playerDna(games: AnalyzedGame[]): DnaAxis[] {
  const moves = games.flatMap(userMoves);
  const rate = (pred: (m: MoveRecord) => boolean, pool: MoveRecord[]) => {
    const n = pool.length || 1;
    return (pool.filter((m) => serious(m) && pred(m)).reduce((a, m) => a + weight(m), 0) / n) * 100;
  };
  const has = (t: Tag) => (m: MoveRecord) => tagsOf(m).includes(t);
  const opening = moves.filter((m) => m.phase === 'opening');
  const endgame = moves.filter((m) => m.phase === 'endgame');
  const nonOpening = moves.filter((m) => m.phase !== 'opening');

  const clocked = games.filter((g) => g.timeClass !== 'daily' && g.moves.some((m) => m.clockAfter !== undefined));
  const ttGames = clocked.filter((g) => userMoves(g).some((m) => m.clockAfter !== undefined && m.clockAfter < Math.max(30, g.baseSeconds * 0.1)));
  const ttBlunders = moves.filter((m) => m.severity === 'blunder' && tagsOf(m).includes('time trouble')).length;
  const timeScore = clocked.length ? Math.round(100 * (1 - ttGames.length / clocked.length) * 0.7 + 30 * (1 - Math.min(1, ttBlunders / Math.max(1, clocked.length)))) : 50;

  const acpl = (pool: MoveRecord[]) => (pool.length ? pool.reduce((a, m) => a + m.cpLoss, 0) / pool.length : 0);
  const early = acpl(moves.filter((m) => m.moveNo >= 10 && m.moveNo <= 30));
  const late = acpl(moves.filter((m) => m.moveNo > 30));
  const stamina = late ? Math.round(Math.min(100, (early / late) * 100)) : 50;

  const conv = conversion(games);
  return [
    { key: 'opening', label: 'Opening', score: toScore(rate(() => true, opening)), detail: `${opening.length} opening moves` },
    { key: 'tactics', label: 'Tactics', score: toScore(rate(has('tactic missed'), nonOpening)), detail: 'missed / allowed forcing moves' },
    { key: 'calc', label: 'Calculation', score: toScore(rate(has('calculation'), nonOpening)), detail: 'forcing lines that failed' },
    { key: 'endgame', label: 'Endgame', score: endgame.length ? toScore(rate(() => true, endgame)) : 50, detail: `${endgame.length} endgame moves` },
    { key: 'time', label: 'Clock', score: timeScore, detail: `time trouble in ${ttGames.length}/${clocked.length} games` },
    { key: 'stamina', label: 'Stamina', score: stamina, detail: `ACPL ${early.toFixed(0)} (moves 10-30) vs ${late.toFixed(0)} (31+)` },
    { key: 'conversion', label: 'Conversion', score: conv.winning ? Math.round((conv.converted / conv.winning) * 100) : 50, detail: `won ${conv.converted}/${conv.winning} winning positions` },
    { key: 'resource', label: 'Defence', score: conv.losing ? Math.round((conv.saved / conv.losing) * 100) : 50, detail: `saved ${conv.saved}/${conv.losing} lost positions` },
  ];
}

const userWin = (g: AnalyzedGame, m: MoveRecord) => {
  const w = winPct(evalToCp(m.evalAfter));
  return g.userColor === 'w' ? w : 100 - w;
};

/** Winning = you hit >= 80% win chance (~+3.8); losing = you dropped to <= 20%. */
export function conversion(games: AnalyzedGame[]) {
  let winning = 0, converted = 0, losing = 0, saved = 0;
  const blown: AnalyzedGame[] = [];
  for (const g of games) {
    const ws = g.moves.slice(10).map((m) => userWin(g, m));
    if (!ws.length) continue;
    if (Math.max(...ws) >= 80) {
      winning++;
      if (g.result === 'win') converted++;
      else blown.push(g);
    }
    if (Math.min(...ws) <= 20) {
      losing++;
      if (g.result !== 'loss') saved++;
    }
  }
  return { winning, converted, losing, saved, blown };
}

export interface Bucket {
  label: string;
  games: number;
  errorsPerGame: number;
}

const HOUR_BUCKETS = [
  { label: 'Morning 5-12', from: 5, to: 12 },
  { label: 'Afternoon 12-17', from: 12, to: 17 },
  { label: 'Evening 17-21', from: 17, to: 21 },
  { label: 'Night 21-5', from: 21, to: 29 },
];

/** Blunder O'Clock: errors per game by local time of day. */
export function blunderOClock(games: AnalyzedGame[]): Bucket[] {
  return HOUR_BUCKETS.map((b) => {
    const gs = games.filter((g) => {
      let h = new Date(g.endTime * 1000).getHours();
      if (h < 5) h += 24;
      return h >= b.from && h < b.to;
    });
    return { label: b.label, games: gs.length, errorsPerGame: gs.length ? gs.reduce((a, g) => a + errorsPerGame(g), 0) / gs.length : 0 };
  });
}

/** Tilt check: errors by game number in a session (games < 30 min apart), and after a loss. */
export function tilt(games: AnalyzedGame[]) {
  const sorted = [...games].sort((a, b) => a.endTime - b.endTime);
  const byIndex = [0, 0, 0, 0].map(() => ({ games: 0, errors: 0 }));
  const afterLoss = { games: 0, errors: 0 };
  const afterOther = { games: 0, errors: 0 };
  let idx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const g = sorted[i];
    const prev = sorted[i - 1];
    // endTime gap minus this game's own length estimate (2x base) keeps sessions tight.
    const sameSession = prev && g.endTime - prev.endTime < 2 * g.baseSeconds + 1800;
    idx = sameSession ? idx + 1 : 0;
    const e = errorsPerGame(g);
    const slot = byIndex[Math.min(idx, 3)];
    slot.games++;
    slot.errors += e;
    if (sameSession) {
      const bucket = prev.result === 'loss' ? afterLoss : afterOther;
      bucket.games++;
      bucket.errors += e;
    }
  }
  const avg = (x: { games: number; errors: number }) => (x.games ? x.errors / x.games : 0);
  return {
    byIndex: byIndex.map((x, i) => ({ label: i === 3 ? '4th+ game' : ['1st game', '2nd game', '3rd game'][i], games: x.games, errorsPerGame: avg(x) })),
    afterLoss: { games: afterLoss.games, errorsPerGame: avg(afterLoss) },
    afterOther: { games: afterOther.games, errorsPerGame: avg(afterOther) },
  };
}

export interface OpeningRow {
  name: string;
  games: number;
  score: number;
  earlyErrors: number;
}

const family = (name?: string) => (name ?? 'Unknown').split(/ (?:Variation|Attack|Defense|Gambit|Opening|Game)\b/)[0].split(' ').slice(0, 4).join(' ');

export function openingReport(games: AnalyzedGame[]): { dangerous: OpeningRow[]; safe: OpeningRow[] } {
  const map = new Map<string, { games: number; points: number; early: number }>();
  for (const g of games) {
    const k = `${family(g.opening)} (${g.userColor === 'w' ? 'W' : 'B'})`;
    const r = map.get(k) ?? { games: 0, points: 0, early: 0 };
    r.games++;
    r.points += g.result === 'win' ? 1 : g.result === 'draw' ? 0.5 : 0;
    r.early += userMoves(g).filter((m) => m.moveNo <= 15).reduce((a, m) => a + weight(m), 0);
    map.set(k, r);
  }
  const rows = [...map.entries()]
    .filter(([, r]) => r.games >= 2)
    .map(([name, r]) => ({ name, games: r.games, score: r.points / r.games, earlyErrors: r.early / r.games }));
  const danger = (r: OpeningRow) => r.earlyErrors + (0.5 - r.score) * 2;
  const sorted = rows.sort((a, b) => danger(b) - danger(a));
  return { dangerous: sorted.filter((r) => danger(r) > 1).slice(0, 5), safe: sorted.filter((r) => danger(r) <= 1).reverse().slice(0, 5) };
}

export function themeCounts(games: AnalyzedGame[]): { theme: Theme; count: number }[] {
  const counts = new Map<Theme, number>();
  for (const g of games)
    for (const m of userMoves(g)) if (serious(m)) for (const t of themesOf(m)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count);
}

export { errorsPerGame };
