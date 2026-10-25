export interface DayLog {
  puzzles: number;
  solved: number;
  think: number;
  xp: number;
}

export interface Progress {
  xp: number;
  days: Record<string, DayLog>;
}

export const EMPTY_PROGRESS: Progress = { xp: 0, days: {} };

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function log(p: Progress, patch: Partial<DayLog>): Progress {
  const k = today();
  const cur = p.days[k] ?? { puzzles: 0, solved: 0, think: 0, xp: 0 };
  const next: DayLog = {
    puzzles: cur.puzzles + (patch.puzzles ?? 0),
    solved: cur.solved + (patch.solved ?? 0),
    think: cur.think + (patch.think ?? 0),
    xp: cur.xp + (patch.xp ?? 0),
  };
  return { xp: p.xp + (patch.xp ?? 0), days: { ...p.days, [k]: next } };
}

/** Consecutive training days ending today (or yesterday, so the streak survives until you train today). */
export function streak(p: Progress): number {
  const d = new Date();
  if (!p.days[today(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (p.days[today(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

const LEVELS = [
  { xp: 0, name: 'Club Player' },
  { xp: 300, name: 'Tournament Rookie' },
  { xp: 1000, name: 'Category E Contender' },
  { xp: 2500, name: 'Prize Hunter' },
  { xp: 5000, name: 'Madurai Shark' },
];

export function level(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const next = LEVELS[i + 1];
  return {
    name: LEVELS[i].name,
    next: next?.name,
    progress: next ? (xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp) : 1,
    toNext: next ? next.xp - xp : 0,
  };
}
