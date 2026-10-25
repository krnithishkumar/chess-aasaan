import { useMemo } from 'react';
import { fmtClock } from '../lib/analyze';
import { patternsForCoach } from '../lib/coachExport';
import { blunderOClock, conversion, openingReport, themeCounts, tilt } from '../lib/insights';
import { coachAdvice, computePatterns, describeClockPct } from '../lib/patterns';
import { THEME_LABEL } from '../lib/themes';
import type { AnalyzedGame } from '../lib/types';
import CopyButton from './CopyButton';

interface Props {
  games: AnalyzedGame[];
  onOpen: (id: string) => void;
}

function Bars({ rows, unit, highlight }: { rows: { label: string; value: number; hint?: string }[]; unit: (v: number) => string; highlight?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <table className="bars">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} title={r.hint} className={r.label === highlight ? 'hl' : ''}>
            <th scope="row">{r.label}</th>
            <td className="bartrack">
              <span className="bar" style={{ width: `${(r.value / max) * 100}%` }} />
            </td>
            <td className="num">{unit(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Coach = ({ children }: { children: React.ReactNode }) => (
  <p className="coach-line">
    <span className="coach-badge sm" aria-hidden>♚</span>
    {children}
  </p>
);

export default function InsightsView({ games, onOpen }: Props) {
  const p = useMemo(() => computePatterns(games), [games]);
  const { advice, warnings } = useMemo(() => coachAdvice(p), [p]);
  const clock = useMemo(() => blunderOClock(games), [games]);
  const tl = useMemo(() => tilt(games), [games]);
  const conv = useMemo(() => conversion(games), [games]);
  const openings = useMemo(() => openingReport(games), [games]);
  const themes = useMemo(() => themeCounts(games), [games]);

  if (!games.length)
    return (
      <div className="panel empty">
        <h2>No insights yet</h2>
        <p className="muted">Analyze some games first. Patterns get trustworthy around 20.</p>
      </div>
    );

  const morning = clock[0];
  const worstSlot = [...clock].filter((c) => c.games >= 2).sort((a, b) => b.errorsPerGame - a.errorsPerGame)[0];
  const first = tl.byIndex[0].errorsPerGame;
  const laterSlots = tl.byIndex.slice(2).filter((x) => x.games >= 2);
  const laterAvg = laterSlots.length ? laterSlots.reduce((a, x) => a + x.errorsPerGame, 0) / laterSlots.length : 0;

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Insights · {p.games} games</div>
          <h1>Where your points go</h1>
        </div>
        <CopyButton text={() => patternsForCoach(p)} label="Copy for Claude coach" />
      </div>

      {warnings.map((w) => (
        <div key={w} className="banner warn">
          ⚠ {w}
        </div>
      ))}

      <h2>Train next</h2>
      <div className="advice">
        {advice.map((a, i) => (
          <article key={a.tag} className="panel advice-card">
            <div className="rank">#{i + 1}</div>
            <div className="eyebrow">{a.tag}</div>
            <h3>{a.headline}</h3>
            <p>{a.drill}</p>
            <p className="tiny muted">
              {a.evidence} {a.trend}
            </p>
          </article>
        ))}
      </div>

      <div className="grid2">
        <div className="panel">
          <h3>Tactics you miss</h3>
          <p className="muted small">Detected from the engine's line on each of your mistakes.</p>
          {themes.length ? (
            <Bars rows={themes.slice(0, 7).map((t) => ({ label: THEME_LABEL[t.theme], value: t.count }))} unit={(v) => String(v)} />
          ) : (
            <p className="muted">No tactical themes yet.</p>
          )}
        </div>

        <div className="panel">
          <h3>Errors by type</h3>
          <p className="muted small">Weighted per game (blunder 2, mistake 1).</p>
          <Bars rows={p.tagStats.map((t) => ({ label: t.tag, value: t.perGame, hint: `${t.count} total` }))} unit={(v) => v.toFixed(2)} />
        </div>

        <div className="panel">
          <h3>Blunder O'Clock</h3>
          <p className="muted small">Errors per game by the time of day you played.</p>
          <Bars rows={clock.map((c) => ({ label: c.label, value: c.errorsPerGame, hint: `${c.games} games` }))} unit={(v) => v.toFixed(1)} highlight={worstSlot?.label} />
          <Coach>
            {morning.games < 3
              ? `Only ${morning.games} morning games. Madurai rounds are in the morning and afternoon, so play some long games before noon.`
              : worstSlot?.label === morning.label
                ? `Mornings are your worst slot (${morning.errorsPerGame.toFixed(1)}/game), and that's when Madurai rounds start. Train at 10am, not midnight.`
                : `Mornings are fine (${morning.errorsPerGame.toFixed(1)}/game). Keep your training at tournament hours.`}
          </Coach>
        </div>

        <div className="panel">
          <h3>Tilt check</h3>
          <p className="muted small">Errors per game by game number in a session.</p>
          <Bars rows={tl.byIndex.map((x) => ({ label: x.label, value: x.errorsPerGame, hint: `${x.games} games` }))} unit={(v) => v.toFixed(1)} />
          <p className="small">
            After a loss: <strong>{tl.afterLoss.errorsPerGame.toFixed(1)}</strong>/game ({tl.afterLoss.games}) · otherwise{' '}
            <strong>{tl.afterOther.errorsPerGame.toFixed(1)}</strong> ({tl.afterOther.games})
          </p>
          <Coach>
            {laterAvg > first * 1.25
              ? 'You get sloppier the longer a session runs. Madurai is 2 rounds a day, so stamina matters. Cap blitz binges at 3 games.'
              : tl.afterLoss.errorsPerGame > tl.afterOther.errorsPerGame * 1.25 && tl.afterLoss.games >= 3
                ? 'You tilt after losses. Between rounds: walk, eat, reset. Never queue the next game straight after a loss.'
                : 'No clear tilt signal. Good, keep it that way.'}
          </Coach>
        </div>

        <div className="panel">
          <h3>Conversion &amp; defence</h3>
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
            <>
              <h4>Blown wins</h4>
              <ul className="plain small">
                {conv.blown.slice(0, 5).map((g) => (
                  <li key={g.id}>
                    <button className="link" onClick={() => onOpen(g.id)}>
                      vs {g.opponent}
                    </button>{' '}
                    <span className="muted">{g.result}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Coach>
            {conv.winning && conv.converted / conv.winning < 0.8
              ? 'Prize money comes from converting. When you are winning, slow down and kill counterplay first.'
              : "Conversion is fine. Prizes come from not losing the bad days."}
          </Coach>
        </div>

        <div className="panel">
          <h3>Stamina</h3>
          <p className="muted small">Average centipawn loss by move number.</p>
          <Bars rows={p.acplByBucket.map((b) => ({ label: b.label, value: b.acpl, hint: `${b.moves} moves` }))} unit={(v) => v.toFixed(0)} />
          <p className="small">
            Clock left at move 20: <strong>{describeClockPct(p.time.avgClockPctAtMove20)}</strong> · move 30: <strong>{describeClockPct(p.time.avgClockPctAtMove30)}</strong>
          </p>
          <h4>Longest thinks</h4>
          <ul className="plain small">
            {p.time.longestThinks.slice(0, 4).map(({ game, move }) => (
              <li key={`${game.id}${move.ply}`}>
                <button className="link" onClick={() => onOpen(game.id)}>
                  {move.moveNo}
                  {move.color === 'w' ? '.' : '...'}
                  {move.san}
                </button>{' '}
                {fmtClock(move.timeSpent!)} vs {game.opponent}
                {move.severity && <span className={`sev ${move.severity}`}> then {move.severity}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h3>Dangerous openings</h3>
          <p className="muted small">Early errors per game and your score (2+ games).</p>
          <ul className="plain small">
            {openings.dangerous.map((o) => (
              <li key={o.name} className="orow">
                <span className="grow">{o.name}</span>
                <span className="muted">{o.games}g · {Math.round(o.score * 100)}% · {o.earlyErrors.toFixed(1)} err</span>
              </li>
            ))}
            {!openings.dangerous.length && <li className="muted">None stand out.</li>}
          </ul>
        </div>
        <div className="panel">
          <h3>Safe openings</h3>
          <p className="muted small">Keep playing these in Madurai.</p>
          <ul className="plain small">
            {openings.safe.map((o) => (
              <li key={o.name} className="orow">
                <span className="grow">{o.name}</span>
                <span className="muted">{o.games}g · {Math.round(o.score * 100)}%</span>
              </li>
            ))}
            {!openings.safe.length && <li className="muted">Need more games per opening.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
