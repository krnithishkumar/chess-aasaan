import { Chess } from 'chess.js';
import { parseTimeControl } from './chesscom';
import type { AnalyzedGame, Color, Eval, MoveRecord, Phase, RawGame, Severity, Tag } from './types';

export interface Evaluator {
  evaluate(fen: string, depth: number): Promise<Eval>;
}

const MATE_CP = 10000;

/** White-POV centipawns, mates mapped to +/-10000 minus distance. */
export function evalToCp(e: Eval): number {
  if (e.mate) return Math.sign(e.mate) * (MATE_CP - Math.abs(e.mate) * 10);
  return e.cp ?? 0;
}

/** Lichess win% model. */
export function winPct(cpWhite: number): number {
  const cp = Math.max(-1000, Math.min(1000, cpWhite));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function formatEval(e: Eval): string {
  if (e.mate !== undefined) return e.mate === 0 ? '#' : `${e.mate > 0 ? '' : '-'}M${Math.abs(e.mate)}`;
  const v = (e.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
}

/** Lichess thresholds expressed in win% points (0.1/0.2/0.3 on the [-1,1] scale). */
function severityOf(loss: number): Severity | undefined {
  if (loss >= 15) return 'blunder';
  if (loss >= 10) return 'mistake';
  if (loss >= 5) return 'inaccuracy';
  return undefined;
}

function phaseOf(fen: string, moveNo: number): Phase {
  const board = fen.split(' ')[0];
  const pieces = (board.match(/[nbrqNBRQ]/g) ?? []).length;
  if (pieces <= 6) return 'endgame';
  if (moveNo <= 12) return 'opening';
  return 'middlegame';
}

function lineToSan(fen: string, uciLine: string[], max = 8): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of uciLine.slice(0, max)) {
    try {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

const isForcing = (san?: string) => !!san && /[x+#]/.test(san);

function parseClocks(pgn: string): number[] {
  const out: number[] = [];
  const re = /\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pgn))) out.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  return out;
}

function header(pgn: string, key: string): string | undefined {
  return new RegExp(`\\[${key} "([^"]*)"\\]`).exec(pgn)?.[1];
}

export function autoTag(m: MoveRecord, base: number): { tags: Tag[]; reason: string } {
  const tags: Tag[] = [];
  const reasons: string[] = [];
  if (!m.severity) return { tags, reason: '' };

  const lowClock = m.clockAfter !== undefined && base > 0 && m.clockAfter < Math.max(30, base * 0.1);
  if (lowClock) {
    tags.push('time trouble');
    reasons.push(`only ${fmtClock(m.clockAfter!)} left after this move`);
  }
  if (m.phase === 'opening') tags.push('opening');
  if (m.phase === 'endgame') tags.push('endgame');

  const serious = m.severity !== 'inaccuracy';
  if (serious && isForcing(m.san) && m.bestSan !== m.san) {
    tags.push('calculation');
    reasons.push(`you went forcing with ${m.san} and the line doesn't work`);
  } else if (serious && isForcing(m.bestSan)) {
    tags.push('tactic missed');
    reasons.push(`missed ${m.bestSan}`);
  } else if (serious && isForcing(m.replySan)) {
    tags.push('tactic missed');
    reasons.push(`allowed ${m.replySan}`);
  } else if (m.severity === 'blunder') {
    tags.push('calculation');
    reasons.push(`quiet blunder: didn't see the reply ${m.replySan ?? ''}`.trim());
  } else {
    tags.push('positional');
    reasons.push(m.bestSan ? `${m.bestSan} was the better plan` : 'misjudged the position');
  }
  return { tags, reason: reasons.join('; ') };
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

function resultFor(raw: RawGame, color: Color): AnalyzedGame['result'] {
  const r = color === 'w' ? raw.white.result : raw.black.result;
  if (r === 'win') return 'win';
  if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(r)) return 'draw';
  return 'loss';
}

export async function analyzeGame(
  raw: RawGame,
  username: string,
  engine: Evaluator,
  depth: number,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<AnalyzedGame> {
  const chess = new Chess();
  chess.loadPgn(raw.pgn);
  const history = chess.history({ verbose: true });
  const clocks = parseClocks(raw.pgn);
  const userColor: Color = raw.white.username.toLowerCase() === username.toLowerCase() ? 'w' : 'b';
  const { base, inc } = parseTimeControl(raw.timeControl);

  const fens = [history[0]?.before ?? chess.fen(), ...history.map((h) => h.after)];
  const evals: Eval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const pos = new Chess(fens[i]);
    if (pos.isCheckmate()) {
      evals.push({ mate: 0, cp: pos.turn() === 'w' ? -MATE_CP : MATE_CP, pv: [], depth: 0 });
    } else if (pos.isDraw()) {
      evals.push({ cp: 0, pv: [], depth: 0 });
    } else {
      evals.push(await engine.evaluate(fens[i], depth));
    }
    onProgress?.(i + 1, fens.length);
  }

  const lastClock: Record<Color, number> = { w: base, b: base };
  const moves: MoveRecord[] = history.map((h, i) => {
    const color = h.color as Color;
    const before = evals[i];
    const after = evals[i + 1];
    const sign = color === 'w' ? 1 : -1;
    const cpBefore = evalToCp(before);
    const cpAfter = evalToCp(after);
    const winBefore = color === 'w' ? winPct(cpBefore) : 100 - winPct(cpBefore);
    const winAfter = color === 'w' ? winPct(cpAfter) : 100 - winPct(cpAfter);
    const uci = h.from + h.to + (h.promotion ?? '');
    const playedBest = before.best === uci;
    const loss = playedBest ? 0 : Math.max(0, winBefore - winAfter);
    const cpLoss = playedBest ? 0 : Math.max(0, Math.min(1000, sign * (cpBefore - cpAfter)));

    const clockAfter = clocks[i];
    let timeSpent: number | undefined;
    if (clockAfter !== undefined && base > 0) {
      timeSpent = Math.max(0, lastClock[color] - clockAfter + inc);
      lastClock[color] = clockAfter;
    }

    const bestLineSan = before.pv.length ? lineToSan(h.before, before.pv) : [];
    const replyLineSan = after.pv.length ? lineToSan(h.after, after.pv) : [];
    const moveNo = Math.floor(i / 2) + 1;
    const rec: MoveRecord = {
      ply: i,
      moveNo,
      color,
      san: h.san,
      uci,
      fenBefore: h.before,
      fenAfter: h.after,
      clockAfter,
      timeSpent,
      evalBefore: before,
      evalAfter: after,
      winBefore,
      winAfter,
      loss,
      cpLoss,
      severity: severityOf(loss),
      phase: phaseOf(h.before, moveNo),
      bestSan: bestLineSan[0],
      bestLineSan,
      replySan: replyLineSan[0],
      replyLineSan,
      autoTags: [],
    };
    const t = autoTag(rec, base);
    rec.autoTags = t.tags;
    rec.reason = t.reason;
    return rec;
  });

  const user = userColor === 'w' ? raw.white : raw.black;
  const opp = userColor === 'w' ? raw.black : raw.white;
  return {
    id: raw.id,
    url: raw.url,
    userColor,
    opponent: opp.username,
    opponentRating: opp.rating,
    userRating: user.rating,
    result: resultFor(raw, userColor),
    timeClass: raw.timeClass,
    timeControl: raw.timeControl,
    baseSeconds: base,
    increment: inc,
    endTime: raw.endTime,
    opening: openingName(raw.pgn),
    depth,
    analyzedAt: Date.now(),
    moves,
  };
}

export function openingName(pgn: string): string | undefined {
  const url = header(pgn, 'ECOUrl');
  if (!url) return header(pgn, 'ECO');
  return decodeURIComponent(url.split('/').pop() ?? '').replace(/-/g, ' ');
}

export function userMoves(g: AnalyzedGame): MoveRecord[] {
  return g.moves.filter((m) => m.color === g.userColor);
}
