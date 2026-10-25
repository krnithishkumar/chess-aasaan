import { useEffect, useMemo, useState } from 'react';
import { fmtClock, formatEval, userMoves } from '../lib/analyze';
import { formatTimeControl } from '../lib/chesscom';
import { gameVerdict } from '../lib/coach';
import { gameForCoach } from '../lib/coachExport';
import { REVIEW_STEPS } from '../lib/curriculum';
import { cardId } from '../lib/quiz';
import { THEME_LABEL, themesOf } from '../lib/themes';
import type { AnalyzedGame, MoveRecord, SelfReview, Tag } from '../lib/types';
import { TAGS, tagsOf } from '../lib/types';
import Board, { ARROW, uciArrow } from './Board';
import CopyButton from './CopyButton';
import EvalGraph from './EvalGraph';

interface Props {
  game: AnalyzedGame;
  onBack: () => void;
  /** Receives an updater so successive edits apply to the latest saved game. */
  onChange: (f: (g: AnalyzedGame) => AnalyzedGame) => void;
  onReviewed: () => void;
  onRetry: (cardId: string) => void;
}

const SEV_MARK = { inaccuracy: '?!', mistake: '?', blunder: '??' } as const;
const EMPTY_REVIEW: SelfReview = { stage: 'self', critical: [], notes: {} };
const mv = (m: MoveRecord) => `${m.moveNo}${m.color === 'w' ? '.' : '...'}${m.san}`;

/** Two-stage review: you analyse the game yourself first (engine hidden), then compare with Stockfish. */
export default function GameView({ game, onBack, onChange, onReviewed, onRetry }: Props) {
  const [ply, setPly] = useState(-1);
  const review = game.review ?? EMPTY_REVIEW;
  const engineOn = review.stage !== 'self';
  const move = ply >= 0 ? game.moves[ply] : undefined;
  const verdict = useMemo(() => gameVerdict(game), [game]);
  const mine = useMemo(() => userMoves(game).filter((m) => m.severity && m.severity !== 'inaccuracy'), [game]);
  // Engine turning points: your mistakes, and the opponent's blunders you could have punished.
  const turning = useMemo(
    () =>
      game.moves.filter((m) =>
        m.color === game.userColor ? m.severity === 'mistake' || m.severity === 'blunder' : m.severity === 'blunder',
      ),
    [game],
  );
  const spotted = (m: MoveRecord) => review.critical.some((p) => Math.abs(p - m.ply) <= 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(-1, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(game.moves.length - 1, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.moves.length]);

  const setReview = (patch: Partial<SelfReview> | ((r: SelfReview) => Partial<SelfReview>)) =>
    onChange((g) => {
      const r = g.review ?? EMPTY_REVIEW;
      return { ...g, review: { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } };
    });
  const updateMove = (m: MoveRecord, patch: Partial<MoveRecord>) =>
    onChange((g) => ({ ...g, moves: g.moves.map((x) => (x.ply === m.ply ? { ...x, ...patch } : x)) }));
  const toggleTag = (m: MoveRecord, t: Tag) => {
    const cur = tagsOf(m);
    updateMove(m, { tags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  };
  const toggleCritical = (p: number) =>
    setReview((r) => ({ critical: r.critical.includes(p) ? r.critical.filter((x) => x !== p) : [...r.critical, p].sort((a, b) => a - b) }));

  const showArrows = engineOn && move?.severity;
  const arrows = showArrows ? [uciArrow(move!.uci, ARROW.played), ...(move!.evalBefore.best ? [uciArrow(move!.evalBefore.best, ARROW.best)] : [])] : [];
  // With arrows, show the position *before* the flagged move so they make sense.
  const boardFen = showArrows ? move!.fenBefore : move ? move.fenAfter : (game.moves[0]?.fenBefore ?? 'start');
  const totalTime = (c: 'w' | 'b') => game.moves.filter((m) => m.color === c).reduce((a, m) => a + (m.timeSpent ?? 0), 0);
  const hasClock = game.moves[0]?.clockAfter !== undefined && game.timeClass !== 'daily';

  return (
    <section className="review-page">
      <div className="toolbar">
        <button onClick={onBack}>← Back</button>
        <div className="grow">
          <strong>
            {game.result === 'win' ? 'Won' : game.result === 'loss' ? 'Lost' : 'Drew'} vs {game.opponent}
          </strong>{' '}
          <span className="muted">
            ({game.opponentRating}) · {formatTimeControl(game.timeControl)} · {game.opening}
          </span>
        </div>
        {engineOn && <CopyButton text={() => gameForCoach(game)} label="Copy for Claude" />}
        <a href={game.url} target="_blank" rel="noreferrer" className="button">
          chess.com ↗
        </a>
      </div>

      <ol className="stepper" aria-label="Review steps">
        {['Your analysis', 'Compare with engine', 'Your rule'].map((s, i) => {
          const cur = review.stage === 'self' ? 0 : review.stage === 'engine' ? 1 : 2;
          return (
            <li key={s} className={i === cur ? 'cur' : i < cur ? 'done' : ''}>
              <span>{i < cur ? '✓' : i + 1}</span> {s}
            </li>
          );
        })}
      </ol>

      {!engineOn ? (
        <div className="panel steps-intro">
          <h2>First, your own analysis</h2>
          <p>The engine is hidden on purpose. Finding the turning points yourself trains the judgment you need at the board.</p>
          <ol className="howto">
            {REVIEW_STEPS.slice(0, 2).map((s) => (
              <li key={s.title}>
                <strong>{s.title}.</strong> {s.text}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className={`verdict panel ${game.result}`}>
          <div className="eyebrow">Engine summary</div>
          <h2>{verdict.headline}</h2>
          <dl className="verdict-points">
            {verdict.points.map((pt) => (
              <div key={pt.label}>
                <dt>{pt.label}</dt>
                <dd>{pt.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {engineOn && (
        <div className="panel compare">
          <h3>
            Turning points: you found {turning.filter(spotted).length} of {turning.length}
          </h3>
          <p className="small muted">The engine's big swings compared with the moments you marked (within one move counts).</p>
          {turning.length ? (
            <ul className="turning">
              {turning.map((m) => (
                <li key={m.ply} className={spotted(m) ? 'hit' : 'miss'}>
                  <span className="mark" aria-hidden>{spotted(m) ? '✓' : '✗'}</span>
                  <button className="link" onClick={() => setPly(m.ply)}>
                    {mv(m)}
                  </button>
                  <span className="small">
                    {m.color === game.userColor ? `your ${m.severity}` : "opponent's blunder, a chance for you"}
                    {m.color !== game.userColor &&
                      game.moves[m.ply + 1]?.bestSan &&
                      (game.moves[m.ply + 1].san === game.moves[m.ply + 1].bestSan
                        ? `: you punished it with ${game.moves[m.ply + 1].san}`
                        : `: you played ${game.moves[m.ply + 1].san}, best was ${game.moves[m.ply + 1].bestSan}`)}
                  </span>
                  <span className="muted small">
                    {formatEval(m.evalBefore)} → {formatEval(m.evalAfter)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No big swings in this game.</p>
          )}
          {review.critical.length > 0 && (
            <>
              <h4>What you marked</h4>
              <ul className="plain small">
                {review.critical.map((p) => (
                  <li key={p}>
                    <button className="link" onClick={() => setPly(p)}>
                      {mv(game.moves[p])}
                    </button>{' '}
                    <span className="muted">{review.notes[p] || 'no note'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="review">
        <div className="col-board">
          <Board fen={boardFen} orientation={game.userColor === 'w' ? 'white' : 'black'} arrows={arrows} />
          <div className="navbtns">
            <button onClick={() => setPly(-1)} aria-label="Start">⏮</button>
            <button onClick={() => setPly((p) => Math.max(-1, p - 1))} aria-label="Previous move">◀</button>
            <button onClick={() => setPly((p) => Math.min(game.moves.length - 1, p + 1))} aria-label="Next move">▶</button>
            <button onClick={() => setPly(game.moves.length - 1)} aria-label="End">⏭</button>
          </div>
          <p className="tiny muted center">Arrow keys also step through the moves.</p>
        </div>

        <div className="col-side">
          {engineOn && <EvalGraph game={game} ply={ply} onSelect={setPly} />}
          <div className="movelist">
            {game.moves.map((m) => (
              <button
                key={m.ply}
                className={`mv ${m.ply === ply ? 'cur' : ''} ${engineOn && m.color === game.userColor && m.severity ? `sev-${m.severity}` : ''} ${review.critical.includes(m.ply) ? 'crit' : ''}`}
                onClick={() => setPly(m.ply)}
              >
                {m.color === 'w' && <span className="muted">{m.moveNo}.</span>}
                {m.san}
                {engineOn && m.color === game.userColor && m.severity && <sup>{SEV_MARK[m.severity]}</sup>}
              </button>
            ))}
          </div>

          {move && (
            <div className="panel moveinfo">
              <div className="row tight">
                <strong>{mv(move)}</strong>
                {engineOn && move.severity && <span className={`sev ${move.severity}`}>{move.severity}</span>}
                {engineOn && (
                  <span className="muted small">
                    {formatEval(move.evalBefore)} → {formatEval(move.evalAfter)}
                  </span>
                )}
                <span className="spacer" />
                {review.stage === 'self' && (
                  <button className={review.critical.includes(move.ply) ? 'chip on' : 'chip'} onClick={() => toggleCritical(move.ply)}>
                    {review.critical.includes(move.ply) ? '★ Turning point' : '☆ Mark as turning point'}
                  </button>
                )}
              </div>
              {engineOn && move.bestSan && move.bestSan !== move.san && (
                <div className="small">
                  Engine preferred <strong>{move.bestSan}</strong> <span className="muted">{move.bestLineSan.slice(1, 6).join(' ')}</span>
                </div>
              )}
              {move.clockAfter !== undefined && game.timeClass !== 'daily' && (
                <div className="small muted">
                  Clock {fmtClock(move.clockAfter)}
                  {move.timeSpent !== undefined && ` · thought for ${fmtClock(move.timeSpent)}`}
                </div>
              )}
              {review.critical.includes(move.ply) && (
                <textarea
                  key={move.ply}
                  placeholder="What were you thinking here? What were you afraid of? What did you expect them to play?"
                  defaultValue={review.notes[move.ply] ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value;
                    const p = move.ply;
                    if (v !== (review.notes[p] ?? '')) setReview((r) => ({ notes: { ...r.notes, [p]: v } }));
                  }}
                />
              )}
              {showArrows && <div className="tiny muted">Red arrow: your move. Green: the engine's move. Board shows the position before.</div>}
            </div>
          )}
          {hasClock && (
            <p className="small muted">
              Time used: you {fmtClock(totalTime(game.userColor))}, opponent {fmtClock(totalTime(game.userColor === 'w' ? 'b' : 'w'))}.
            </p>
          )}
        </div>
      </div>

      {review.stage === 'self' && (
        <div className="panel marked">
          <h3>Your turning points ({review.critical.length})</h3>
          {review.critical.length ? (
            <ul className="plain">
              {review.critical.map((p) => (
                <li key={p}>
                  <button className="link" onClick={() => setPly(p)}>
                    {mv(game.moves[p])}
                  </button>{' '}
                  <span className="muted small">{review.notes[p] || 'no note yet'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Step through the game and mark the moves where you think it turned. Most games have 2 to 5.</p>
          )}
          <div className="row">
            <button className="primary" disabled={!review.critical.length} onClick={() => setReview({ stage: 'engine' })}>
              Compare with the engine →
            </button>
            <button className="link small" onClick={() => setReview({ stage: 'engine' })}>
              skip self-analysis for this game
            </button>
          </div>
        </div>
      )}

      {engineOn && (
        <>
          <h2>Your mistakes ({mine.length})</h2>
          {!mine.length && <p className="muted">No mistakes or blunders by the engine's standard. Look at the inaccuracies (?!) in the move list.</p>}
          <div className="mistakes">
            {mine.map((m) => (
              <article key={m.ply} className={`panel mistake ${m.ply === ply ? 'cur' : ''}`}>
                <header onClick={() => setPly(m.ply)}>
                  <span className={`sev ${m.severity}`}>{SEV_MARK[m.severity!]}</span>
                  <strong>{mv(m)}</strong>
                  <span className="muted small">
                    {formatEval(m.evalBefore)} → {formatEval(m.evalAfter)} · best {m.bestSan}
                    {m.clockAfter !== undefined && game.timeClass !== 'daily' && ` · ${fmtClock(m.clockAfter)} left`}
                  </span>
                </header>
                {m.reason && <p className="small">{m.reason}.</p>}
                <div className="chips static">
                  {themesOf(m).map((t) => (
                    <span key={t} className="chip theme">{THEME_LABEL[t]}</span>
                  ))}
                  <button className="chip retry" onClick={() => onRetry(cardId(game.id, m.ply))}>
                    ↻ Drill this position
                  </button>
                </div>
                <div className="small muted">Why did it happen? Correct the label if it's wrong:</div>
                <div className="chips">
                  {TAGS.map((t) => (
                    <button key={t} className={tagsOf(m).includes(t) ? 'chip on' : 'chip'} onClick={() => toggleTag(m, t)}>
                      {t}
                    </button>
                  ))}
                  {m.tags && (
                    <button className="link small" onClick={() => updateMove(m, { tags: undefined })}>
                      reset
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="panel lesson">
            <h2>{review.stage === 'done' ? 'Your rule from this game' : 'Last step: one rule'}</h2>
            <p className="small muted">{REVIEW_STEPS[3].text} Example: "Before every capture, check what their recapture attacks."</p>
            <textarea
              key={review.stage}
              defaultValue={review.lesson ?? ''}
              placeholder="In my next game I will…"
              onBlur={(e) => e.target.value !== (review.lesson ?? '') && setReview({ lesson: e.target.value.trim() })}
              id="lesson"
            />
            {review.stage === 'engine' && (
              <div className="row">
                <button
                  className="primary"
                  onClick={() => {
                    const el = document.getElementById('lesson') as HTMLTextAreaElement | null;
                    setReview({ stage: 'done', doneAt: Date.now(), lesson: el?.value.trim() || review.lesson });
                    onReviewed();
                  }}
                >
                  Finish review
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
