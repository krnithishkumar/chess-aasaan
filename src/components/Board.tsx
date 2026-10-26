import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Chess } from 'chess.js';
import { QUALITY, type Quality } from '../lib/analyze';
import { playMove } from '../lib/sound';
import { Chessboard } from 'react-chessboard';
import type { Arrow, Square } from 'react-chessboard/dist/chessboard/types';

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  arrows?: Arrow[];
  /** Return true to accept the move. Enables drag and click-to-move. */
  onMove?: (from: Square, to: Square) => boolean;
  highlight?: Partial<Record<Square, 'hint' | 'good' | 'bad' | 'last'>>;
  /** Move-quality badge pinned to a square's corner, like Best ★ or Blunder ??. */
  badge?: { square: Square; quality: Quality };
  /** Insight strip attached to the top edge of the board. */
  caption?: ReactNode;
}

/** Which sound a position change deserves: capture if a piece disappeared, check if the side to move is in check. */
function soundFor(prev: string, next: string) {
  const count = (f: string) => (f.split(' ')[0].match(/[a-z]/gi) ?? []).length;
  let check = false;
  try {
    check = new Chess(next).inCheck();
  } catch {
    /* partial FEN */
  }
  return check ? 'check' : count(next) < count(prev) ? 'capture' : 'move';
}

const HL = {
  hint: { boxShadow: 'inset 0 0 0 4px rgba(233,185,73,0.95)' },
  good: { background: 'rgba(12,163,12,0.45)' },
  bad: { background: 'rgba(208,59,59,0.45)' },
  last: { background: 'rgba(233,185,73,0.35)' },
};

export default function Board({ fen, orientation, arrows, onMove, highlight, badge, caption }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prevFen = useRef(fen);
  const [width, setWidth] = useState(400);
  const [selected, setSelected] = useState<Square | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(Math.min(e.contentRect.width, 600))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setSelected(null);
    const prev = prevFen.current;
    prevFen.current = fen;
    if (prev.split(' ')[0] !== fen.split(' ')[0]) playMove(soundFor(prev, fen));
  }, [fen]);

  const targets = useMemo(() => {
    if (!selected) return [] as Square[];
    try {
      return new Chess(fen).moves({ square: selected, verbose: true }).map((m) => m.to as Square);
    } catch {
      return [];
    }
  }, [fen, selected]);

  const styles: Record<string, React.CSSProperties> = {};
  for (const [sq, kind] of Object.entries(highlight ?? {})) styles[sq] = HL[kind!];
  if (selected) styles[selected] = { background: 'rgba(233,185,73,0.5)' };
  for (const t of targets)
    styles[t] = { ...styles[t], backgroundImage: 'radial-gradient(circle, rgba(10,14,20,0.35) 22%, transparent 24%)' };

  const onSquareClick = (sq: Square) => {
    if (!onMove) return;
    if (selected && targets.includes(sq)) {
      onMove(selected, sq);
      setSelected(null);
      return;
    }
    const c = new Chess(fen);
    const p = c.get(sq);
    setSelected(p && p.color === c.turn() ? sq : null);
  };

  const sq = width / 8;
  let badgeEl: ReactNode = null;
  if (badge) {
    const f = badge.square.charCodeAt(0) - 97;
    const r = Number(badge.square[1]) - 1;
    const x = orientation === 'white' ? f : 7 - f;
    const y = orientation === 'white' ? 7 - r : r;
    const size = Math.max(20, Math.round(sq * 0.4));
    badgeEl = (
      <span
        className={`qbadge q-${badge.quality}`}
        style={{ left: (x + 1) * sq - size * 0.7, top: y * sq - size * 0.3, width: size, height: size, fontSize: size * 0.5 }}
        title={QUALITY[badge.quality].label}
        aria-label={QUALITY[badge.quality].label}
      >
        {QUALITY[badge.quality].mark}
      </span>
    );
  }

  return (
    <div className="board-wrap">
      {caption && <div className="board-caption">{caption}</div>}
      <div ref={ref} className="board">
        <Chessboard
          position={fen}
          boardWidth={width}
          boardOrientation={orientation}
          customArrows={arrows}
          arePiecesDraggable={!!onMove}
          onPieceDrop={onMove ? (from, to) => onMove(from, to) : undefined}
          onSquareClick={onSquareClick}
          autoPromoteToQueen
          animationDuration={180}
          customSquareStyles={styles}
          customBoardStyle={{ borderRadius: '12px', boxShadow: '0 4px 18px rgba(31,35,40,0.14)' }}
          customDarkSquareStyle={{ backgroundColor: '#7f9c82' }}
          customLightSquareStyle={{ backgroundColor: '#eeebdc' }}
        />
        {badgeEl}
      </div>
    </div>
  );
}

export const uciArrow = (uci: string, color: string): Arrow => [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, color];
export const ARROW = { played: 'rgba(208,59,59,0.85)', best: 'rgba(12,163,12,0.85)', hint: 'rgba(233,185,73,0.85)' };
