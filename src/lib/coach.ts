import { fmtClock, formatEval, userMoves } from './analyze';
import { conversion } from './insights';
import { THEME_LABEL, themesOf } from './themes';
import type { AnalyzedGame, MoveRecord, Tag } from './types';
import { tagsOf } from './types';

const SHORT_DRILL: Record<Tag, string> = {
  'tactic missed': 'Mistake drills filtered to "tactic missed", and the blunder check before every move.',
  calculation: 'Think trainer: write the full line before you commit. 5 positions.',
  endgame: 'Rook endings from 100 Endgames You Must Know, then your endgame mistake drills.',
  'time trouble': 'Next long game: check your clock at moves 20, 30 and 40 against the time plan.',
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
  else if (conv.blown.length) headline = `You had a winning position and ${g.result === 'draw' ? 'drew' : 'lost'}. The lesson is in how the win slipped away.`;
  else if (g.result === 'win') headline = `Won, with ${errors.length} real error${errors.length > 1 ? 's' : ''} a stronger opponent would punish.`;
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
  if (habit) points.push({ label: 'Most common error', text: `${habit} (${errors.filter((m) => tagsOf(m).includes(habit)).length} of ${errors.length} errors).` });

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
  if (habit) points.push({ label: 'Train', text: SHORT_DRILL[habit] });
  return { headline, points };
}
