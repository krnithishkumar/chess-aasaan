import { useState } from 'react';
import { evalToCp, formatEval, winPct } from '../lib/analyze';
import type { AnalyzedGame } from '../lib/types';

interface Props {
  game: AnalyzedGame;
  ply: number;
  onSelect: (ply: number) => void;
}

const W = 600;
const H = 120;
const SEV_MARK = { inaccuracy: '?!', mistake: '?', blunder: '??' } as const;

/** White win% after each move; your mistakes are marked. */
export default function EvalGraph({ game, ply, onSelect }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = game.moves.length;
  if (!n) return null;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (i: number) => H - (winPct(evalToCp(game.moves[i].evalAfter)) / 100) * H;
  const pts = game.moves.map((_, i) => `${x(i).toFixed(1)},${y(i).toFixed(1)}`);
  const area = `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
  const marks = game.moves.filter((m) => m.color === game.userColor && (m.severity === 'mistake' || m.severity === 'blunder'));
  const h = hover !== null ? game.moves[hover] : null;

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))));
  };

  return (
    <figure className="evalgraph">
      <figcaption className="muted small">White's winning chances after each move · your mistakes marked</figcaption>
      <div className="graphwrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Evaluation graph"
          onMouseMove={(e) => setHover(pick(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => onSelect(pick(e))}
        >
          <rect x={0} y={0} width={W} height={H} className="g-black" />
          <path d={area} className="g-white" />
          <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="g-mid" />
          <line x1={x(ply)} x2={x(ply)} y1={0} y2={H} className="g-cursor" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="g-hover" />}
        </svg>
        {marks.map((m) => (
          <button
            key={m.ply}
            className={`gmark sev ${m.severity}`}
            style={{ left: `${(x(m.ply) / W) * 100}%`, top: `${(y(m.ply) / H) * 100}%` }}
            onClick={() => onSelect(m.ply)}
            title={`${m.moveNo}${m.color === 'w' ? '.' : '...'}${m.san} ${m.severity}`}
          >
            {SEV_MARK[m.severity!]}
          </button>
        ))}
        {h && (
          <div className="tooltip" style={{ left: `${(x(hover!) / W) * 100}%` }}>
            <strong>
              {h.moveNo}
              {h.color === 'w' ? '.' : '...'}
              {h.san}
            </strong>{' '}
            {formatEval(h.evalAfter)}
          </div>
        )}
      </div>
    </figure>
  );
}
