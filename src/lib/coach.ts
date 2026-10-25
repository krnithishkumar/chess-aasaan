import { fmtClock, formatEval, userMoves } from './analyze';
import type { DnaAxis } from './insights';
import { conversion } from './insights';
import { coachAdvice, computePatterns } from './patterns';
import type { Progress } from './progress';
import { today } from './progress';
import { THEME_LABEL, themesOf } from './themes';
import type { AnalyzedGame, MoveRecord, Tag } from './types';
import { tagsOf } from './types';

const SHORT_DRILL: Record<Tag, string> = {
  'tactic missed': 'Blunder Book on your "tactic missed" cards, then a checks-captures-threats scan before every move.',
  calculation: 'Classical-think mode: write the full line before you commit. 10 positions.',
  endgame: 'Rook endings from 100 Endgames You Must Know, then replay your endgame cards.',
  'time trouble': 'Next long game: write your clock at moves 15, 20 and 30. Hit the checkpoints.',
  opening: 'Look up the line you left at the first mistake. Plans, not move orders.',
  positional: 'Before each quiet move, name the worst piece (yours and theirs). Do it in your next 3 games.',
};

const mv = (m: MoveRecord) => `${m.moveNo}${m.color === 'w' ? '.' : '...'}${m.san}`;

export interface Verdict {
  headline: string;
  points: { label: string; text: string }[];
}

/** The coach's post-game take, built only from engine numbers and your clock. */
export function gameVerdict(g: AnalyzedGame): Verdict {
  const mine = userMoves(g);
  const errors = mine.filter((m) => m.severity === 'mistake' || m.severity === 'blunder');
  const worst = [...mine].sort((a, b) => b.loss - a.loss)[0];
  const points: Verdict['points'] = [];
  const conv = conversion([g]);

  let headline: string;
  if (!errors.length) headline = g.result === 'win' ? 'Clean game. This is the standard.' : 'No big errors and still not a win. Find where the small stuff added up.';
  else if (conv.blown.length) headline = `You had it won and ${g.result === 'draw' ? 'drew' : 'lost'}. That's a conversion problem, not a knowledge problem.`;
  else if (g.result === 'win') headline = `Won, but ${errors.length} real error${errors.length > 1 ? 's' : ''}. A stronger opponent punishes those.`;
  else headline = `${errors.length} error${errors.length > 1 ? 's' : ''} decided this one.`;

  if (worst && worst.severity) {
    const theme = themesOf(worst)[0];
    points.push({
      label: 'Turning point',
      text: `${mv(worst)} (${formatEval(worst.evalBefore)} → ${formatEval(worst.evalAfter)}). ${worst.bestSan ? `${worst.bestSan} was the move.` : ''}${theme ? ` ${THEME_LABEL[theme]}.` : ''}`,
    });
  }

  const tagCount = new Map<Tag, number>();
  errors.forEach((m) => tagsOf(m).forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + (m.severity === 'blunder' ? 2 : 1))));
  const habit = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (habit) points.push({ label: 'The habit', text: `${habit} (${errors.filter((m) => tagsOf(m).includes(habit)).length} of ${errors.length} errors).` });

  const clocked = mine.filter((m) => m.clockAfter !== undefined);
  if (clocked.length && g.timeClass !== 'daily') {
    const tt = clocked.find((m) => m.clockAfter! < Math.max(30, g.baseSeconds * 0.1));
    const longest = [...clocked].sort((a, b) => (b.timeSpent ?? 0) - (a.timeSpent ?? 0))[0];
    points.push({
      label: 'Clock',
      text: tt
        ? `In time trouble from move ${tt.moveNo}. Longest think: ${fmtClock(longest.timeSpent ?? 0)} on ${mv(longest)}.`
        : `Never short of time. Longest think ${fmtClock(longest.timeSpent ?? 0)} on ${mv(longest)}.`,
    });
  }
  if (habit) points.push({ label: 'Drill', text: SHORT_DRILL[habit] });
  return { headline, points };
}

export interface Mission {
  id: string;
  title: string;
  detail: string;
  target: number;
  done: number;
  action: 'puzzles' | 'think' | 'review' | 'analyze';
}

export function dailyMission(games: AnalyzedGame[], progress: Progress, dueCount: number, unanalyzed: number): Mission[] {
  const day = progress.days[today()] ?? { puzzles: 0, solved: 0, think: 0, xp: 0 };
  const p = computePatterns(games);
  const top = coachAdvice(p).advice[0];
  const yesterday = games.find((g) => Date.now() / 1000 - g.endTime < 36 * 3600 && g.result !== 'win');
  const missions: Mission[] = [
    {
      id: 'puzzles',
      title: `${Math.min(10, Math.max(dueCount, 5))} Blunder Book puzzles`,
      detail: top ? `Focus: ${top.tag}. Your own positions, no generic puzzles.` : 'Positions from your own games.',
      target: Math.min(10, Math.max(dueCount, 5)),
      done: day.puzzles,
      action: 'puzzles',
    },
    {
      id: 'think',
      title: '2 classical-think positions',
      detail: 'Write a plan and candidate moves on the clock, like a 90+30 game. This is your gap.',
      target: 2,
      done: day.think,
      action: 'think',
    },
  ];
  if (yesterday)
    missions.push({
      id: 'review',
      title: `Review your ${yesterday.result} vs ${yesterday.opponent}`,
      detail: 'Read the verdict and tag-check every mistake. Two minutes.',
      target: 1,
      done: 0,
      action: 'review',
    });
  else if (unanalyzed)
    missions.push({ id: 'analyze', title: 'Analyze your new games', detail: `${unanalyzed} games waiting.`, target: 1, done: 0, action: 'analyze' });
  return missions;
}

export function hqMessage(games: AnalyzedGame[], dna: DnaAxis[], daysLeft: number, streakDays: number): string {
  if (!games.length) return `${daysLeft} days to Madurai. Give me some games to work with and I'll tell you where the points are leaking.`;
  const weakest = [...dna].sort((a, b) => a.score - b.score)[0];
  const strongest = [...dna].sort((a, b) => b.score - a.score)[0];
  const p = computePatterns(games);
  const top = p.tagStats[0];
  const parts = [`${daysLeft} days to Madurai.`];
  parts.push(`Weakest area right now: ${weakest.label.toLowerCase()} (${weakest.score}). ${weakest.detail}.`);
  if (top?.count) parts.push(`Most of your points go to "${top.tag}", ${top.perGame.toFixed(1)} weighted errors a game.`);
  parts.push(`${strongest.label} (${strongest.score}) is holding up, so don't waste hours there.`);
  if (streakDays === 0) parts.push("You haven't trained today. Start with the mission below.");
  else if (streakDays >= 3) parts.push(`${streakDays}-day streak. Keep it going.`);
  return parts.join(' ');
}
