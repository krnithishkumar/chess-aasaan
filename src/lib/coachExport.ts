import { fmtClock, formatEval } from './analyze';
import { coachAdvice, describeClockPct, type Patterns } from './patterns';
import type { AnalyzedGame } from './types';
import { tagsOf } from './types';

const PREAMBLE = `You are my chess coach. I'm 28, ~2100 rapid on chess.com (nithish_ravi), no FIDE rating.
Goal: first FIDE-rated classical tournament, Category E, Madurai, Dec 29-31, 2026. Training ~4 hrs/day, competing for prizes.
Rules: be direct and casual, push back when I'm wrong. The Stockfish evals below are the truth; don't calculate yourself or invent positions.
Focus on my gap: classical OTB calculation, time management, endgames, stamina, not basic theory.`;

/** Annotated game text (engine evals + tags) for pasting into a Claude chat. */
export function gameForCoach(g: AnalyzedGame): string {
  const lines: string[] = [];
  const me = g.userColor === 'w' ? 'White' : 'Black';
  lines.push(PREAMBLE, '');
  lines.push(
    `Game: me (${me}, ${g.userRating}) vs ${g.opponent} (${g.opponentRating}), ${g.timeControl}, result: ${g.result}. ${g.opening ?? ''}`,
  );
  lines.push(`Engine: Stockfish 18 depth ${g.depth}. Evals are White's point of view. ${g.url}`, '');
  let pgn = '';
  for (const m of g.moves) {
    pgn += m.color === 'w' ? `${m.moveNo}. ${m.san} ` : `${m.san} `;
    const bits = [formatEval(m.evalAfter)];
    if (m.clockAfter !== undefined) bits.push(`clk ${fmtClock(m.clockAfter)}`);
    if (m.severity && m.color === g.userColor)
      bits.push(`${m.severity.toUpperCase()} best ${m.bestSan} (${m.bestLineSan.slice(0, 5).join(' ')}) tags: ${tagsOf(m).join(', ')}`);
    pgn += `{${bits.join(' | ')}} `;
  }
  lines.push(pgn.trim(), '');
  lines.push(
    'Tag check: are my auto-tags right? Then tell me the 1-2 habits that cost me this game and what to train this week.',
  );
  return lines.join('\n');
}

export function patternsForCoach(p: Patterns): string {
  const { advice, warnings } = coachAdvice(p);
  const lines = [PREAMBLE, '', `Patterns across my last ${p.games} analyzed games (Stockfish 18):`];
  for (const t of p.tagStats) lines.push(`- ${t.tag}: ${t.count} mistakes/blunders, ${t.perGame.toFixed(2)} weighted/game`);
  lines.push(`Severity: ${p.severity.blunder} blunders, ${p.severity.mistake} mistakes, ${p.severity.inaccuracy} inaccuracies`);
  lines.push(`Avg centipawn loss by move: ${p.acplByBucket.map((b) => `${b.label} ${b.acpl.toFixed(0)}`).join(', ')}`);
  lines.push(
    `Clock left at move 20: ${describeClockPct(p.time.avgClockPctAtMove20)}, move 30: ${describeClockPct(p.time.avgClockPctAtMove30)}; time trouble in ${p.time.timeTroubleGames}/${p.time.gamesWithClock} games`,
  );
  lines.push(`Time controls: ${p.timeControls.map((t) => `${t.tc} x${t.games}`).join(', ')}`);
  if (warnings.length) lines.push('', ...warnings);
  lines.push('', `App's suggested focus: ${advice.map((a) => a.tag).join(', ')}`);
  lines.push('Push back if this is wrong. Give me a weekly plan to Dec 29 with ~4 hrs/day.');
  return lines.join('\n');
}
