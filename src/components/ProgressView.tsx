import { useMemo } from 'react';
import { fmtClock } from '../lib/analyze';
import { patternsForCoach } from '../lib/coachExport';
import { TIME_CHECKPOINTS } from '../lib/curriculum';
import { blunderOClock, clockCheckpoints, conversion, openingReport, playerDna, themeCounts, tilt, trend } from '../lib/insights';
import { computePatterns } from '../lib/patterns';
import { lastWeek, type Progress } from '../lib/progress';
import { THEME_LABEL } from '../lib/themes';
import type { AnalyzedGame } from '../lib/types';
import CopyButton from './CopyButton';

interface Props {
  games: AnalyzedGame[];
  progress: Progress;
  onOpen: (id: string) => void;
}

function Bars({ rows, unit, max, tone }: { rows: { label: string; value: number; hint?: string }[]; unit: (v: number) => string; max?: number; tone?: (v: number) => string }) {
  const m = max ?? Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <table className="bars">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} title={r.hint}>
            <th scope="row">{r.label}</th>
            <td className="bartrack">
              <span className={`bar ${tone?.(r.value) ?? ''}`} style={{ width: `${Math.min(1, r.value / m) * 100}%` }} />
            </td>
            <td className="num">{unit(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const pct = (x?: number) => (x === undefined ? 'n/a' : `${Math.round(x * 100)}%`);

export default function ProgressView({ games, progress, onOpen }: Props) {
  const p = useMemo(() => computePatterns(games), [games]);
  const dna = useMemo(() => [...playerDna(games)].sort((a, b) => a.score - b.score), [games]);
  const tr = useMemo(() => trend(games), [games]);
  const cps = useMemo(() => clockCheckpoints(games, TIME_CHECKPOINTS), [games]);
  const clock = useMemo(() => blunderOClock(games), [games]);
  const tl = useMemo(() => tilt(games), [games]);
  const conv = useMemo(() => conversion(games), [games]);
  const openings = useMemo(() => openingReport(games), [games]);
  const themes = useMemo(() => themeCounts(games), [games]);
  const week = lastWeek(progress);

  const first = tr[0];
  const last = tr[tr.length - 1];
  const change = tr.length >= 2 && first.errorsPerGame ? (last.errorsPerGame - first.errorsPerGame) / first.errorsPerGame : undefined;

  return (
    <section>
      <header className="page-head">
        <div>
          <div className="eyebrow">Progress · {p.games} analysed games</div>
          <h1>Are you getting better?</h1>
          <p className="lede">Measured only from Stockfish's verdict on your games and your own training log.</p>
        </div>
        {games.length > 0 && <CopyButton text={() => patternsForCoach(p)} label="Copy for Claude" />}
      </header>

      <div className="panel">
        <h3>Your training this week</h3>
        <div className="week">
          {week.map((d) => (
            <div key={d.key} className={`day ${d.active ? 'on' : ''}`}>
              <div className="day-l">{d.label}</div>
              <div className="day-v">
                {d.active ? (
                  <>
                    {d.log.drills > 0 && <div>{d.log.drills} drills</div>}
                    {d.log.think > 0 && <div>{d.log.think} think</div>}
                    {d.log.reviews > 0 && <div>{d.log.reviews} review</div>}
                    {d.log.blocks.length > 0 && <div>{d.log.blocks.length} blocks</div>}
                  </>
                ) : (
                  <span className="muted">–</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!games.length ? (
        <div className="panel empty">
          <h2>No game data yet</h2>
          <p className="muted">Analyse some games first. Patterns become trustworthy around 20 games.</p>
        </div>
      ) : (
        <>
          <div className="panel">
            <h3>Errors per game over time</h3>
            <p className="small muted">Your games in groups of 10, oldest first. Mistake = 1, blunder = 2. Lower is better. This is the number that should fall.</p>
            {tr.length >= 2 ? (
              <>
                <Bars rows={tr.map((t) => ({ label: t.label, value: t.errorsPerGame, hint: `${t.games} games, avg centipawn loss ${t.acpl.toFixed(0)}` }))} unit={(v) => v.toFixed(2)} />
                <p className="small">
                  {change! < -0.1
                    ? `Down ${Math.round(-change! * 100)}% from your first group. The training is working.`
                    : change! > 0.1
                      ? `Up ${Math.round(change! * 100)}% from your first group. Check the time controls: faster games give more errors.`
                      : 'About flat so far. Improvement shows up over weeks, not days.'}
                </p>
              </>
            ) : (
              <p className="muted">Needs at least 20 analysed games to show a trend.</p>
            )}
          </div>

          <div className="grid2">
            <div className="panel">
              <h3>Strengths and weaknesses</h3>
              <p className="small muted">0-100, from your own error rates in each area. Weakest first. Not a rating.</p>
              <Bars rows={dna.map((d) => ({ label: d.label, value: d.score, hint: d.detail }))} unit={(v) => String(v)} max={100} tone={(v) => (v < 45 ? 'weak' : v >= 70 ? 'strong' : '')} />
              <ul className="plain tiny muted">
                {dna.slice(0, 3).map((d) => (
                  <li key={d.key}>
                    {d.label}: {d.detail}
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel">
              <h3>Clock vs the time plan</h3>
              <p className="small muted">How often you still had enough time at each checkpoint (scaled to each game's time control).</p>
              <table className="simple">
                <thead>
                  <tr>
                    <th>Checkpoint</th>
                    <th>In 90+30</th>
                    <th>Your average</th>
                    <th>On plan</th>
                  </tr>
                </thead>
                <tbody>
                  {cps.map((c) => (
                    <tr key={c.move}>
                      <td>{c.label}</td>
                      <td>{c.classical}</td>
                      <td>{pct(c.avgPct)} of base</td>
                      <td>{c.reached ? `${c.ok}/${c.reached}` : 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small">
                Time trouble in <strong>{p.time.timeTroubleGames}</strong> of {p.time.gamesWithClock} games; {p.time.blundersInTimeTrouble} of {p.time.totalBlunders} blunders came in time trouble.
              </p>
            </div>

            <div className="panel">
              <h3>Mistake types</h3>
              <p className="small muted">Weighted per game. Correct the labels in game reviews to make this more accurate.</p>
              <Bars rows={p.tagStats.map((t) => ({ label: t.tag, value: t.perGame, hint: `${t.count} total` }))} unit={(v) => v.toFixed(2)} />
            </div>

            <div className="panel">
              <h3>Tactics you miss</h3>
              <p className="small muted">What the engine's move was, on each of your mistakes.</p>
              {themes.length ? (
                <Bars rows={themes.slice(0, 7).map((t) => ({ label: THEME_LABEL[t.theme], value: t.count }))} unit={(v) => String(v)} />
              ) : (
                <p className="muted">None found yet.</p>
              )}
            </div>

            <div className="panel">
              <h3>Winning won, losing saved</h3>
              <div className="duo">
                <div>
                  <div className="big">{conv.winning ? Math.round((conv.converted / conv.winning) * 100) : 0}%</div>
                  <div className="muted small">
                    winning positions won ({conv.converted}/{conv.winning})
                  </div>
                </div>
                <div>
                  <div className="big">{conv.losing ? Math.round((conv.saved / conv.losing) * 100) : 0}%</div>
                  <div className="muted small">
                    lost positions saved ({conv.saved}/{conv.losing})
                  </div>
                </div>
              </div>
              {conv.blown.length > 0 && (
                <p className="small">
                  Wins that slipped away:{' '}
                  {conv.blown.slice(0, 5).map((g, i) => (
                    <span key={g.id}>
                      {i > 0 && ', '}
                      <button className="link" onClick={() => onOpen(g.id)}>
                        vs {g.opponent}
                      </button>
                    </span>
                  ))}
                  . When winning: slow down, take away their counterplay, then trade.
                </p>
              )}
            </div>

            <div className="panel">
              <h3>Late-game accuracy</h3>
              <p className="small muted">Average centipawn loss by move number. If it climbs late, that's tiredness or the clock.</p>
              <Bars rows={p.acplByBucket.map((b) => ({ label: b.label, value: b.acpl, hint: `${b.moves} moves` }))} unit={(v) => v.toFixed(0)} />
              {p.time.longestThinks.length > 0 && (
                <p className="small muted">
                  Longest think: {fmtClock(p.time.longestThinks[0].move.timeSpent!)} on move {p.time.longestThinks[0].move.moveNo} vs {p.time.longestThinks[0].game.opponent}.
                </p>
              )}
            </div>

            <div className="panel">
              <h3>Time of day</h3>
              <p className="small muted">Errors per game by when you played. Classical rounds are usually morning and afternoon.</p>
              <Bars rows={clock.map((c) => ({ label: c.label, value: c.errorsPerGame, hint: `${c.games} games` }))} unit={(v) => v.toFixed(1)} />
            </div>

            <div className="panel">
              <h3>Games in a row</h3>
              <p className="small muted">Errors per game by its place in a session, and right after a loss.</p>
              <Bars rows={tl.byIndex.map((x) => ({ label: x.label, value: x.errorsPerGame, hint: `${x.games} games` }))} unit={(v) => v.toFixed(1)} />
              <p className="small">
                After a loss: <strong>{tl.afterLoss.errorsPerGame.toFixed(1)}</strong> per game ({tl.afterLoss.games} games). Otherwise:{' '}
                <strong>{tl.afterOther.errorsPerGame.toFixed(1)}</strong>.
              </p>
            </div>

            <div className="panel">
              <h3>Openings to look at</h3>
              <p className="small muted">Early errors per game and your score (2+ games).</p>
              <ul className="plain small">
                {openings.dangerous.map((o) => (
                  <li key={o.name} className="orow">
                    <span className="grow">{o.name}</span>
                    <span className="muted">
                      {o.games} games · {Math.round(o.score * 100)}% · {o.earlyErrors.toFixed(1)} errors
                    </span>
                  </li>
                ))}
                {!openings.dangerous.length && <li className="muted">None stand out.</li>}
              </ul>
            </div>
            <div className="panel">
              <h3>Openings that work</h3>
              <p className="small muted">Low early errors and a good score. Keep playing these.</p>
              <ul className="plain small">
                {openings.safe.map((o) => (
                  <li key={o.name} className="orow">
                    <span className="grow">{o.name}</span>
                    <span className="muted">
                      {o.games} games · {Math.round(o.score * 100)}%
                    </span>
                  </li>
                ))}
                {!openings.safe.length && <li className="muted">Need more games per opening.</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
