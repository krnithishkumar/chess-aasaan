import { fmtClock, userMoves } from './analyze';
import type { AnalyzedGame, MoveRecord, Tag } from './types';
import { TAGS, tagsOf } from './types';

const WEIGHT = { inaccuracy: 0, mistake: 1, blunder: 2 } as const;

export interface TagStat {
  tag: Tag;
  count: number;
  blunders: number;
  /** Weighted errors per game (blunder 2, mistake 1). */
  perGame: number;
  recentPerGame: number;
  olderPerGame: number;
}

export interface Patterns {
  games: number;
  tagStats: TagStat[];
  severity: { inaccuracy: number; mistake: number; blunder: number };
  acplByBucket: { label: string; acpl: number; moves: number }[];
  time: {
    gamesWithClock: number;
    timeTroubleGames: number;
    blundersInTimeTrouble: number;
    totalBlunders: number;
    avgClockPctAtMove20?: number;
    avgClockPctAtMove30?: number;
    longestThinks: { game: AnalyzedGame; move: MoveRecord }[];
  };
  openingLeaks: { opening: string; errors: number; games: number }[];
  timeControls: { tc: string; games: number }[];
}

const serious = (m: MoveRecord) => m.severity === 'mistake' || m.severity === 'blunder';

function perGame(games: AnalyzedGame[], tag: Tag): number {
  if (!games.length) return 0;
  let w = 0;
  for (const g of games)
    for (const m of userMoves(g)) if (m.severity && tagsOf(m).includes(tag)) w += WEIGHT[m.severity];
  return w / games.length;
}

export function computePatterns(games: AnalyzedGame[]): Patterns {
  const recent = games.slice(0, 10);
  const older = games.slice(10);
  const severity = { inaccuracy: 0, mistake: 0, blunder: 0 };
  const tagCounts = new Map<Tag, { count: number; blunders: number }>();
  const buckets = [
    { label: 'Moves 1-15', from: 1, to: 15, loss: 0, n: 0 },
    { label: 'Moves 16-30', from: 16, to: 30, loss: 0, n: 0 },
    { label: 'Moves 31-45', from: 31, to: 45, loss: 0, n: 0 },
    { label: 'Moves 46+', from: 46, to: 999, loss: 0, n: 0 },
  ];
  const openings = new Map<string, { errors: number; games: number }>();
  const tcs = new Map<string, number>();
  let gamesWithClock = 0, ttGames = 0, blundersTT = 0;
  const pct20: number[] = [], pct30: number[] = [];
  const thinks: { game: AnalyzedGame; move: MoveRecord }[] = [];

  for (const g of games) {
    tcs.set(g.timeControl, (tcs.get(g.timeControl) ?? 0) + 1);
    const ms = userMoves(g);
    const op = g.opening ?? 'Unknown';
    const o = openings.get(op) ?? { errors: 0, games: 0 };
    o.games++;
    let hasClock = false, hadTT = false;
    for (const m of ms) {
      if (m.severity) severity[m.severity]++;
      if (serious(m)) {
        for (const t of tagsOf(m)) {
          const c = tagCounts.get(t) ?? { count: 0, blunders: 0 };
          c.count++;
          if (m.severity === 'blunder') c.blunders++;
          tagCounts.set(t, c);
        }
        if (m.phase === 'opening') o.errors++;
        if (m.severity === 'blunder' && tagsOf(m).includes('time trouble')) blundersTT++;
      }
      const b = buckets.find((x) => m.moveNo >= x.from && m.moveNo <= x.to)!;
      b.loss += m.cpLoss;
      b.n++;
      if (m.clockAfter !== undefined && g.baseSeconds > 0 && g.timeClass !== 'daily') {
        hasClock = true;
        if (m.clockAfter < Math.max(30, g.baseSeconds * 0.1)) hadTT = true;
        if (m.moveNo === 20) pct20.push(m.clockAfter / g.baseSeconds);
        if (m.moveNo === 30) pct30.push(m.clockAfter / g.baseSeconds);
        if (m.timeSpent !== undefined) thinks.push({ game: g, move: m });
      }
    }
    openings.set(op, o);
    if (hasClock) gamesWithClock++;
    if (hadTT) ttGames++;
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
  const tagStats: TagStat[] = TAGS.map((tag) => ({
    tag,
    count: tagCounts.get(tag)?.count ?? 0,
    blunders: tagCounts.get(tag)?.blunders ?? 0,
    perGame: perGame(games, tag),
    recentPerGame: perGame(recent, tag),
    olderPerGame: perGame(older, tag),
  })).sort((a, b) => b.perGame - a.perGame);

  return {
    games: games.length,
    tagStats,
    severity,
    acplByBucket: buckets.map((b) => ({ label: b.label, acpl: b.n ? b.loss / b.n : 0, moves: b.n })),
    time: {
      gamesWithClock,
      timeTroubleGames: ttGames,
      blundersInTimeTrouble: blundersTT,
      totalBlunders: severity.blunder,
      avgClockPctAtMove20: avg(pct20),
      avgClockPctAtMove30: avg(pct30),
      longestThinks: thinks.sort((a, b) => b.move.timeSpent! - a.move.timeSpent!).slice(0, 5),
    },
    openingLeaks: [...openings.entries()]
      .map(([opening, v]) => ({ opening, ...v }))
      .filter((x) => x.errors > 0)
      .sort((a, b) => b.errors / b.games - a.errors / a.games)
      .slice(0, 5),
    timeControls: [...tcs.entries()].map(([tc, n]) => ({ tc, games: n })).sort((a, b) => b.games - a.games),
  };
}

const DRILLS: Record<Tag, { headline: string; drill: string }> = {
  calculation: {
    headline: 'Your forcing lines break down.',
    drill:
      '45 min/day: hard calculation positions (Yusupov Orange/Blue, or puzzles rated 2300+). Write the full line on paper before touching a piece, 10 min cap per position, then check with the engine. Finish with your "calculation" quiz cards here.',
  },
  'tactic missed': {
    headline: "You're missing forcing moves, both yours and your opponent's.",
    drill:
      '30 min/day of pattern puzzles at 1900-2200 for speed, and in every game do a checks-captures-threats scan for BOTH sides before you press the clock. Drill your "tactic missed" quiz cards until they are boring.',
  },
  endgame: {
    headline: 'Endgames are leaking points.',
    drill:
      "45 min/day: 100 Endgames You Must Know (rook endings first, Lucena/Philidor/Vancura cold). Then play your own endgame quiz positions out vs Stockfish from the losing side. In classical you'll reach many more endgames than in 10+0.",
  },
  'time trouble': {
    headline: "You're living on the increment.",
    drill:
      'For 90+30 classical, set checkpoints: move 20 with >= 55 min, move 30 with >= 30 min, move 40 with >= 10 min plus the 30s bonus. Play 2-3 games a week at 30+20 or 45+15 and check this tab after every one.',
  },
  opening: {
    headline: 'Errors before move 12.',
    drill:
      "Don't memorize more theory. Take the specific openings listed below, learn the main plans and pawn structures, and replay 3 master games in each. 15 min/day max; it's not your main gap.",
  },
  positional: {
    headline: 'Quiet-position misjudgements.',
    drill:
      '2 annotated master games a week in your structures (guess-the-move, write down a plan every 5 moves). In quiz mode, write the plan before the candidate moves. That habit is the training.',
  },
};

export interface Advice {
  tag: Tag;
  headline: string;
  drill: string;
  evidence: string;
  trend?: string;
}

export function coachAdvice(p: Patterns): { advice: Advice[]; warnings: string[] } {
  const warnings: string[] = [];
  const fastGames = p.timeControls.filter((t) => {
    if (t.tc.includes('/')) return false;
    const [b, i] = t.tc.split('+').map(Number);
    return b + 40 * (i || 0) < 1800;
  });
  const fast = fastGames.reduce((a, t) => a + t.games, 0);
  if (p.games && fast / p.games > 0.6)
    warnings.push(
      `${fast} of ${p.games} analyzed games are under 30 min. Classical is 90+30, a different sport. Your time-management and stamina numbers below are mostly blitz habits. Play at least 2 long games a week (30+20 or slower) so this data means something.`,
    );
  if (p.games < 10) warnings.push(`Only ${p.games} games analyzed. Patterns get trustworthy around 20+.`);

  const advice = p.tagStats
    .filter((t) => t.count > 0)
    .slice(0, 3)
    .map((t) => {
      let trend: string | undefined;
      if (p.games > 15 && t.olderPerGame > 0) {
        const ch = (t.recentPerGame - t.olderPerGame) / t.olderPerGame;
        if (ch < -0.2) trend = `Improving: ${Math.round(-ch * 100)}% fewer in your last 10 games.`;
        else if (ch > 0.2) trend = `Getting worse: ${Math.round(ch * 100)}% more in your last 10 games.`;
        else trend = 'Flat over your last 10 games.';
      }
      return {
        tag: t.tag,
        ...DRILLS[t.tag],
        evidence: `${t.count} mistakes/blunders (${t.blunders} blunders), ${t.perGame.toFixed(2)} weighted per game.`,
        trend,
      };
    });
  return { advice, warnings };
}

export function describeClockPct(x?: number): string {
  return x === undefined ? 'n/a' : `${Math.round(x * 100)}%`;
}

export { fmtClock };
