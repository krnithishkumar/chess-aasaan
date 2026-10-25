import { useEffect, useMemo, useState } from 'react';
import { fmtClock, formatEval, userMoves } from '../lib/analyze';
import { formatTimeControl } from '../lib/chesscom';
import { gameVerdict } from '../lib/coach';
import { gameForCoach } from '../lib/coachExport';
import { cardId } from '../lib/quiz';
import { THEME_LABEL, themesOf } from '../lib/themes';
import type { AnalyzedGame, MoveRecord, Tag } from '../lib/types';
import { TAGS, tagsOf } from '../lib/types';
import Board, { uciArrow } from './Board';
import CopyButton from './CopyButton';
import EvalGraph from './EvalGraph';

interface Props {
  game: AnalyzedGame;
  onBack: () => void;
  onChange: (g: AnalyzedGame) => void;
  onRetry: (cardId: string) => void;
}

const SEV_MARK = { inaccuracy: '?!', mistake: '?', blunder: '??' } as const;

export default function GameView({ game, onBack, onChange, onRetry }: Props) {
  const [ply, setPly] = useState(-1);
  const move = ply >= 0 ? game.moves[ply] : undefined;
  const fen = move ? move.fenAfter : (game.moves[0]?.fenBefore ?? 'start');
  const verdict = useMemo(() => gameVerdict(game), [game]);
  const mine = useMemo(() => userMoves(game).filter((m) => m.severity && m.severity !== 'inaccuracy'), [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(-1, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(game.moves.length - 1, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.moves.length]);

  const arrows = move?.severity
    ? [uciArrow(move.uci, 'rgba(208,59,59,0.8)'), ...(move.evalBefore.best ? [uciArrow(move.evalBefore.best, 'rgba(12,163,12,0.8)')] : [])]
    : [];
  // Show the position *before* a flagged move so the arrows make sense.
  const boardFen = move?.severity ? move.fenBefore : fen;

  const updateMove = (m: MoveRecord, patch: Partial<MoveRecord>) =>
    onChange({ ...game, moves: game.moves.map((x) => (x.ply === m.ply ? { ...x, ...patch } : x)) });

  const toggleTag = (m: MoveRecord, t: Tag) => {
    const cur = tagsOf(m);
    updateMove(m, { tags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  };

  const totalTime = (c: 'w' | 'b') => game.moves.filter((m) => m.color === c).reduce((a, m) => a + (m.timeSpent ?? 0), 0);

  return (
    <section>
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
        <CopyButton text={() => gameForCoach(game)} label="Copy for Claude coach" />
        <a href={game.url} target="_blank" rel="noreferrer" className="button">
          chess.com ↗
        </a>
      </div>

      <div className={`verdict panel ${game.result}`}>
        <div className="verdict-head">
          <span className="coach-badge" aria-hidden>♚</span>
          <div>
            <div className="eyebrow">Coach's verdict</div>
            <h2>{verdict.headline}</h2>
          </div>
        </div>
        <dl className="verdict-points">
          {verdict.points.map((pt) => (
            <div key={pt.label}>
              <dt>{pt.label}</dt>
              <dd>{pt.text}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="review">
        <div className="col-board">
          <Board fen={boardFen} orientation={game.userColor === 'w' ? 'white' : 'black'} arrows={arrows} />
          <div className="navbtns">
            <button onClick={() => setPly(-1)} aria-label="Start">⏮</button>
            <button onClick={() => setPly((p) => Math.max(-1, p - 1))} aria-label="Previous">◀</button>
            <button onClick={() => setPly((p) => Math.min(game.moves.length - 1, p + 1))} aria-label="Next">▶</button>
            <button onClick={() => setPly(game.moves.length - 1)} aria-label="End">⏭</button>
          </div>
          {move && (
            <div className="panel moveinfo">
              <div>
                <strong>
                  {move.moveNo}
                  {move.color === 'w' ? '.' : '...'}
                  {move.san}
                </strong>{' '}
                {move.severity && <span className={`sev ${move.severity}`}>{SEV_MARK[move.severity]} {move.severity}</span>}{' '}
                <span className="muted">
                  {formatEval(move.evalBefore)} → {formatEval(move.evalAfter)}
                </span>
              </div>
              {move.bestSan && move.bestSan !== move.san && (
                <div className="small">
                  Engine: <strong>{move.bestSan}</strong> <span className="muted">{move.bestLineSan.slice(1, 6).join(' ')}</span>
                </div>
              )}
              {move.clockAfter !== undefined && (
                <div className="small muted">
                  Clock {fmtClock(move.clockAfter)}
                  {move.timeSpent !== undefined && ` · spent ${fmtClock(move.timeSpent)}`}
                </div>
              )}
              {move.severity && <div className="small muted">Arrows: red = played, green = engine best (position before the move).</div>}
            </div>
          )}
        </div>

        <div className="col-side">
          <EvalGraph game={game} ply={ply} onSelect={setPly} />
          <div className="movelist">
            {game.moves.map((m) => (
              <button
                key={m.ply}
                className={`mv ${m.ply === ply ? 'cur' : ''} ${m.color === game.userColor && m.severity ? `sev-${m.severity}` : ''}`}
                onClick={() => setPly(m.ply)}
              >
                {m.color === 'w' && <span className="muted">{m.moveNo}.</span>}
                {m.san}
                {m.color === game.userColor && m.severity && <sup>{SEV_MARK[m.severity]}</sup>}
              </button>
            ))}
          </div>
          {game.moves[0]?.clockAfter !== undefined && game.timeClass !== 'daily' && (
            <p className="small muted">
              Time used: you {fmtClock(totalTime(game.userColor))}, opponent {fmtClock(totalTime(game.userColor === 'w' ? 'b' : 'w'))}.
            </p>
          )}
        </div>
      </div>

      <h2>Your mistakes ({mine.length})</h2>
      {!mine.length && <p className="muted">No mistakes or blunders by the engine's standard. Look at the inaccuracies in the move list anyway.</p>}
      <div className="mistakes">
        {mine.map((m) => (
          <article key={m.ply} className={`panel mistake ${m.ply === ply ? 'cur' : ''}`}>
            <header onClick={() => setPly(m.ply)}>
              <span className={`sev ${m.severity}`}>{SEV_MARK[m.severity!]}</span>
              <strong>
                {m.moveNo}
                {m.color === 'w' ? '.' : '...'}
                {m.san}
              </strong>
              <span className="muted small">
                {formatEval(m.evalBefore)} → {formatEval(m.evalAfter)} · best {m.bestSan}
                {m.clockAfter !== undefined && game.timeClass !== 'daily' && ` · ${fmtClock(m.clockAfter)} left`}
              </span>
            </header>
            {m.reason && <p className="small">{m.reason}</p>}
            <div className="chips static">
              {themesOf(m).map((t) => (
                <span key={t} className="chip theme">{THEME_LABEL[t]}</span>
              ))}
              <button className="chip retry" onClick={() => onRetry(cardId(game.id, m.ply))}>
                ↻ Retry in Blunder Book
              </button>
            </div>
            <div className="chips">
              {TAGS.map((t) => (
                <button key={t} className={tagsOf(m).includes(t) ? 'chip on' : 'chip'} onClick={() => toggleTag(m, t)}>
                  {t}
                </button>
              ))}
              {m.tags && (
                <button className="link small" onClick={() => updateMove(m, { tags: undefined })}>
                  reset to auto
                </button>
              )}
            </div>
            <textarea
              placeholder="What were you thinking? (helps spot the habit)"
              defaultValue={m.note}
              onBlur={(e) => e.target.value !== (m.note ?? '') && updateMove(m, { note: e.target.value })}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
