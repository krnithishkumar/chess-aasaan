import { useState } from 'react';
import type { DnaAxis } from '../lib/insights';

/** Player DNA: one series, so no legend; each axis is labelled with its score. */
export default function Radar({ axes }: { axes: DnaAxis[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const size = 340;
  const c = size / 2;
  const r = 110;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const;
  };
  const poly = axes.map((ax, i) => pt(i, Math.max(0.04, ax.score / 100)).join(',')).join(' ');
  const h = hover !== null ? axes[hover] : null;

  return (
    <div className="radar">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Player DNA radar">
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <polygon key={k} points={axes.map((_, i) => pt(i, k).join(',')).join(' ')} className="r-grid" />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} className="r-grid" />;
        })}
        <polygon points={poly} className="r-area" />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, Math.max(0.04, ax.score / 100));
          const [lx, ly] = pt(i, 1.27);
          return (
            <g key={ax.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x} cy={y} r={hover === i ? 7 : 5} className="r-dot" />
              <circle cx={lx} cy={ly} r={26} fill="transparent" />
              <text x={lx} y={ly - 4} textAnchor="middle" className="r-label">
                {ax.label}
              </text>
              <text x={lx} y={ly + 12} textAnchor="middle" className={`r-score ${ax.score < 45 ? 'weak' : ''}`}>
                {ax.score}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="radar-detail small">
        {h ? (
          <>
            <strong>{h.label} {h.score}</strong> · {h.detail}
          </>
        ) : (
          <span className="muted">Hover an axis for the numbers behind it. Scores come from your own error rates, not a rating.</span>
        )}
      </div>
    </div>
  );
}
