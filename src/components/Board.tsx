import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { Arrow, Square } from 'react-chessboard/dist/chessboard/types';

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  arrows?: Arrow[];
  /** Return true to accept the move. Enables drag and click-to-move. */
  onMove?: (from: Square, to: Square) => boolean;
  highlight?: Partial<Record<Square, 'hint' | 'good' | 'bad' | 'last'>>;
}

const HL = {
  hint: { boxShadow: 'inset 0 0 0 4px rgba(233,185,73,0.95)' },
  good: { background: 'rgba(12,163,12,0.45)' },
  bad: { background: 'rgba(208,59,59,0.45)' },
  last: { background: 'rgba(233,185,73,0.35)' },
};

export default function Board({ fen, orientation, arrows, onMove, highlight }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const [selected, setSelected] = useState<Square | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(Math.min(e.contentRect.width, 600))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSelected(null), [fen]);

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

  return (
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
        customBoardStyle={{ borderRadius: '10px', boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}
        customDarkSquareStyle={{ backgroundColor: '#6f8f72' }}
        customLightSquareStyle={{ backgroundColor: '#e8e4d0' }}
      />
    </div>
  );
}

export const uciArrow = (uci: string, color: string): Arrow => [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, color];
export const ARROW = { played: 'rgba(208,59,59,0.85)', best: 'rgba(12,163,12,0.85)', hint: 'rgba(233,185,73,0.85)' };
