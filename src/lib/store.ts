import { createStore, del, get, getMany, keys, set } from 'idb-keyval';
import type { AnalyzedGame, QuizCard, RawGame, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { EMPTY_PROGRESS, type Progress } from './progress';

const db = createStore('chess-aasaan', 'kv');

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await get('settings', db)) ?? {}) };
}
export const saveSettings = (s: Settings) => set('settings', s, db);

/** Raw games are cached per archive month; past months never change. */
export const loadMonth = (url: string) => get<RawGame[]>(`month:${url}`, db);
export const saveMonth = (url: string, games: RawGame[]) => set(`month:${url}`, games, db);

export async function loadAllRaw(): Promise<RawGame[]> {
  const ks = (await keys(db)).filter((k) => String(k).startsWith('month:'));
  const months = await getMany<RawGame[]>(ks, db);
  return months.flat().sort((a, b) => b.endTime - a.endTime);
}

export const saveAnalysis = (g: AnalyzedGame) => set(`an:${g.id}`, g, db);
export const deleteAnalysis = (id: string) => del(`an:${id}`, db);

export async function loadAllAnalyses(): Promise<AnalyzedGame[]> {
  const ks = (await keys(db)).filter((k) => String(k).startsWith('an:'));
  return (await getMany<AnalyzedGame>(ks, db)).sort((a, b) => b.endTime - a.endTime);
}

export async function loadQuiz(): Promise<Record<string, QuizCard>> {
  return (await get('quiz', db)) ?? {};
}
export const saveQuiz = (q: Record<string, QuizCard>) => set('quiz', q, db);

export async function loadProgress(): Promise<Progress> {
  return (await get('progress', db)) ?? EMPTY_PROGRESS;
}
export const saveProgress = (p: Progress) => set('progress', p, db);
