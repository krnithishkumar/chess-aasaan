import type { RawGame } from './types';

const API = 'https://api.chess.com/pub/player';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`chess.com ${res.status} for ${url}`);
  return res.json();
}

export async function fetchArchives(username: string): Promise<string[]> {
  const data = await getJson<{ archives: string[] }>(`${API}/${username.toLowerCase()}/games/archives`);
  return data.archives;
}

interface ApiGame {
  url: string;
  pgn?: string;
  time_class: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  rules: string;
  uuid: string;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
  accuracies?: { white: number; black: number };
}

export async function fetchMonth(archiveUrl: string): Promise<RawGame[]> {
  const data = await getJson<{ games: ApiGame[] }>(archiveUrl);
  return data.games
    .filter((g) => g.rules === 'chess' && g.pgn)
    .map((g) => ({
      id: g.uuid,
      url: g.url,
      pgn: g.pgn!,
      timeClass: g.time_class,
      timeControl: g.time_control,
      endTime: g.end_time,
      rated: g.rated,
      white: { username: g.white.username, rating: g.white.rating, result: g.white.result },
      black: { username: g.black.username, rating: g.black.rating, result: g.black.result },
      accuracies: g.accuracies,
    }));
}

/** "600" -> 600s+0, "900+10" -> 900s+10, daily "1/86400" -> 86400s+0. */
export function parseTimeControl(tc: string): { base: number; inc: number } {
  if (tc.includes('/')) return { base: Number(tc.split('/')[1]) || 0, inc: 0 };
  const [base, inc] = tc.split('+').map(Number);
  return { base: base || 0, inc: inc || 0 };
}

export function formatTimeControl(tc: string): string {
  if (tc.includes('/')) return `${Math.round(Number(tc.split('/')[1]) / 86400)}d/move`;
  const { base, inc } = parseTimeControl(tc);
  return `${base / 60}+${inc}`;
}
