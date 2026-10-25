import type { BlockId } from './curriculum';

/** What you did on one day. A plain log, no points. */
export interface DayLog {
  drills: number;
  solved: number;
  think: number;
  reviews: number;
  /** Off-app blocks (books, long games) you ticked off. */
  blocks: BlockId[];
}

export interface Progress {
  days: Record<string, Partial<DayLog>>;
}

export const EMPTY_PROGRESS: Progress = { days: {} };

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayLog(p: Progress, key = today()): DayLog {
  const d = p.days[key] ?? {};
  return { drills: d.drills ?? 0, solved: d.solved ?? 0, think: d.think ?? 0, reviews: d.reviews ?? 0, blocks: d.blocks ?? [] };
}

export function log(p: Progress, patch: Partial<Omit<DayLog, 'blocks'>>): Progress {
  const cur = dayLog(p);
  const next: DayLog = {
    ...cur,
    drills: cur.drills + (patch.drills ?? 0),
    solved: cur.solved + (patch.solved ?? 0),
    think: cur.think + (patch.think ?? 0),
    reviews: cur.reviews + (patch.reviews ?? 0),
  };
  return { days: { ...p.days, [today()]: next } };
}

export function toggleBlock(p: Progress, id: BlockId): Progress {
  const cur = dayLog(p);
  const blocks = cur.blocks.includes(id) ? cur.blocks.filter((b) => b !== id) : [...cur.blocks, id];
  return { days: { ...p.days, [today()]: { ...cur, blocks } } };
}

/** The last 7 days, oldest first. */
export function lastWeek(p: Progress): { key: string; label: string; log: DayLog; active: boolean }[] {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = today(d);
    const l = dayLog(p, key);
    out.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      log: l,
      active: l.drills + l.think + l.reviews + l.blocks.length > 0,
    });
  }
  return out;
}
