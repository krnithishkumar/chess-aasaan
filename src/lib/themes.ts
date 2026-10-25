import { Chess, type Square } from 'chess.js';
import type { MoveRecord } from './types';

export type Theme =
  | 'mate'
  | 'fork'
  | 'hanging piece'
  | 'check'
  | 'promotion'
  | 'capture'
  | 'quiet move'
  | 'allowed mate'
  | 'allowed fork'
  | 'left piece hanging'
  | 'allowed check'
  | 'allowed capture';

export const THEME_LABEL: Record<Theme, string> = {
  mate: 'Missed mate',
  fork: 'Missed fork',
  'hanging piece': 'Missed free piece',
  check: 'Missed check',
  promotion: 'Missed promotion',
  capture: 'Missed capture',
  'quiet move': 'Missed quiet move',
  'allowed mate': 'Allowed mate',
  'allowed fork': 'Allowed fork',
  'left piece hanging': 'Left a piece hanging',
  'allowed check': 'Allowed check tactic',
  'allowed capture': 'Allowed capture',
};

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Classify a forcing idea by playing `uci` on `fen` and looking at the board. */
function classify(fen: string, uci: string): 'fork' | 'hanging piece' | 'check' | 'promotion' | 'capture' | 'quiet move' | null {
  const c = new Chess(fen);
  let m;
  try {
    m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
  const me = m.color;
  const opp = me === 'w' ? 'b' : 'w';
  const to = m.to as Square;

  // Fork: the moved piece hits two valuable targets, at least one worth more than itself or undefended.
  const movedVal = VALUE[m.promotion ?? m.piece];
  const targets: { sq: Square; val: number }[] = [];
  for (const row of c.board())
    for (const p of row) {
      if (!p || p.color !== opp || VALUE[p.type] < 3) continue;
      if (c.attackers(p.square, me).includes(to)) targets.push({ sq: p.square, val: VALUE[p.type] });
    }
  const recapturable = c.attackers(to, opp).length > 0;
  if (!recapturable && targets.length >= 2 && targets.some((t) => t.val > movedVal || c.attackers(t.sq, opp).length === 0))
    return 'fork';

  if (m.captured && !recapturable && VALUE[m.captured] >= 3) return 'hanging piece';
  if (m.promotion) return 'promotion';
  if (m.san.includes('+')) return 'check';
  if (m.captured) return 'capture';
  return 'quiet move';
}

/** Themes for one of your mistakes: what you missed, and what you allowed. */
export function themesOf(m: MoveRecord): Theme[] {
  const out: Theme[] = [];
  const sign = m.color === 'w' ? 1 : -1;
  if (m.evalBefore.mate && sign * m.evalBefore.mate > 0) out.push('mate');
  else if (m.evalBefore.best) {
    const t = classify(m.fenBefore, m.evalBefore.best);
    if (t) out.push(t);
  }
  if (m.evalAfter.mate && sign * m.evalAfter.mate < 0) out.push('allowed mate');
  else if (m.evalAfter.best && m.severity === 'blunder') {
    const t = classify(m.fenAfter, m.evalAfter.best);
    if (t === 'fork') out.push('allowed fork');
    else if (t === 'hanging piece') out.push('left piece hanging');
    else if (t === 'check') out.push('allowed check');
    else if (t === 'capture') out.push('allowed capture');
  }
  return out;
}
