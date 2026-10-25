import { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { evalToCp, formatEval, winPct } from '../lib/analyze';
import { getEngine } from '../lib/engine';
import { findMove } from '../lib/quiz';
import { THEME_LABEL, themesOf } from '../lib/themes';
import type { AnalyzedGame, QuizAttempt, QuizCard } from '../lib/types';
import { tagsOf } from '../lib/types';
import Board, { ARROW, uciArrow } from './Board';

interface Props {
  games: AnalyzedGame[];
  deck: QuizCard[];
  depth: number;
  onResult: (card: QuizCard, attempt: QuizAttempt) => void;
  onOpen: (gameId: string) => void;
  onExit: () => void;
}

type Status = 'solving' | 'checking' | 'wrong' | 'solved' | 'failed';
const MAX_TRIES = 3;
/** A move within this many win% points of the engine's best also counts. */
const TOLERANCE = 3;

export default function BlunderBook({ games, deck, depth, onResult, onOpen, onExit }: Props) {
  const [session] = useState(() => deck.slice(0, 10));
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<Status>('solving');
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const [fen, setFen] = useState('');
  const [feedback, setFeedback] = useState('');
  const [lastTry, setLastTry] = useState<{ from: Square; to: Square } | null>(null);
  const [results, setResults] = useState<{ ok: boolean }[]>([]);

  const card = session[i];
  const found = card ? findMove(games, card) : undefined;
  const themes = useMemo(() => (found ? themesOf(found.move) : []), [found]);

  useEffect(() => {
    if (!found) return;
    setFen(found.move.fenBefore);
    setStatus('solving');
    setTries(0);
    setHint(false);
    setShowMine(false);
    setFeedback('');
    setLastTry(null);
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session.length)
    return (
      <div className="panel empty">
        <h2>Nothing due</h2>
        <p className="muted">Every mistake from your analysed games becomes a position here. Analyse more games, or come back tomorrow when older ones are due again.</p>
        <button onClick={onExit}>Back</button>
      </div>
    );

  if (i >= session.length) {
    const ok = results.filter((r) => r.ok).length;
    return (
      <div className="panel summary-card">
        <div className="eyebrow">Session finished</div>
        <h1>
          {ok}/{results.length} solved
        </h1>
        <p className="lede">
          {ok === results.length
            ? 'All solved. They come back after a longer gap to check the pattern stuck.'
            : ok >= results.length / 2
              ? 'The ones you missed come back tomorrow. Missing them here is how you stop missing them in games.'
              : 'A hard session, which means these really are your blind spots. Next time go slower: checks, captures and threats for both sides before you move.'}
        </p>
        <button className="primary" onClick={onExit}>
          Done
        </button>
      </div>
    );
  }

  if (!found) {
    setI((x) => x + 1);
    return null;
  }

  const { game, move } = found;
  const best = move.evalBefore.best!;
  const finished = status === 'solved' || status === 'failed';
  const orientation = move.color === 'w' ? 'white' : 'black';

  const finish = (ok: boolean) => {
    const grade: QuizAttempt['grade'] = ok ? (tries === 0 && !hint ? 'got' : 'partial') : 'missed';
    setStatus(ok ? 'solved' : 'failed');
    setResults((r) => [...r, { ok }]);
    onResult(card, { at: Date.now(), plan: '', candidates: [], hitBest: ok, grade });
  };

  const onMove = (from: Square, to: Square): boolean => {
    if (status !== 'solving' && status !== 'wrong') return false;
    const c = new Chess(move.fenBefore);
    let m;
    try {
      m = c.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    const uci = m.from + m.to + (m.promotion ?? '');
    setFen(c.fen());
    setLastTry({ from, to });
    if (uci === best) {
      setFeedback(`${m.san}! That's the engine's move.`);
      finish(true);
      return true;
    }
    if (uci === move.uci) {
      setFeedback(`${m.san} is what you played in the game. Same mistake. Look again.`);
      wrong();
      return true;
    }
    setStatus('checking');
    setFeedback(`Checking ${m.san} with Stockfish…`);
    getEngine()
      .evaluate(c.fen(), Math.min(depth, 14))
      .then((e) => {
        const w = winPct(evalToCp(e));
        const mine = move.color === 'w' ? w : 100 - w;
        if (move.winBefore - mine <= TOLERANCE) {
          setFeedback(`${m.san} works too (${formatEval(e)}). Engine's first choice was ${move.bestSan}.`);
          finish(true);
        } else {
          setFeedback(`${m.san} isn't it (${formatEval(e)}).`);
          wrong();
        }
      });
    return true;
  };

  function wrong() {
    const t = tries + 1;
    setTries(t);
    if (t >= MAX_TRIES) {
      finish(false);
      return;
    }
    setStatus('wrong');
    setTimeout(() => {
      setFen(move.fenBefore);
      setLastTry(null);
    }, 900);
  }

  const reveal = () => {
    setFen(move.fenBefore);
    setFeedback(`The move was ${move.bestSan}.`);
    finish(false);
  };

  const arrows = [
    ...(finished ? [uciArrow(best, ARROW.best)] : []),
    ...(showMine || finished ? [uciArrow(move.uci, ARROW.played)] : []),
  ];
  const highlight: Record<string, 'hint' | 'good' | 'bad'> = {};
  if (hint && !finished) highlight[best.slice(0, 2)] = 'hint';
  if (lastTry) {
    const ok = status === 'solved';
    highlight[lastTry.from] = ok ? 'good' : 'bad';
    highlight[lastTry.to] = ok ? 'good' : 'bad';
  }

  return (
    <div className="trainer">
      <div className="trainer-board">
        <div className="puzzle-head">
          <span className="eyebrow">
            Position {i + 1} of {session.length}
          </span>
          <div className="dots">
            {session.map((_, k) => (
              <span key={k} className={`dot ${k < results.length ? (results[k].ok ? 'ok' : 'miss') : k === i ? 'cur' : ''}`} />
            ))}
          </div>
        </div>
        <Board fen={fen || move.fenBefore} orientation={orientation} arrows={finished ? arrows : showMine ? arrows : []} onMove={finished ? undefined : onMove} highlight={highlight} />
      </div>

      <div className="trainer-side panel">
        <div className="eyebrow">
          vs {game.opponent} ({game.opponentRating}) · move {move.moveNo}
        </div>
        <h2 className="prompt">What should you have played?</h2>
        <p className="muted">
          {move.color === 'w' ? 'White' : 'Black'} to move. Eval before your move: <strong>{formatEval(move.evalBefore)}</strong>.
          {move.clockAfter !== undefined && game.timeClass !== 'daily' && ` You had ${Math.round((move.clockAfter + (move.timeSpent ?? 0)) / 60)} min.`}
        </p>

        {feedback && (
          <div className={`feedback ${status === 'solved' ? 'ok' : status === 'failed' ? 'miss' : status === 'checking' ? '' : 'warn'}`} role="status">
            {feedback}
            {status === 'wrong' && <span className="muted"> {MAX_TRIES - tries} tries left.</span>}
          </div>
        )}

        {!finished ? (
          <div className="row">
            <button onClick={() => setHint(true)} disabled={hint}>
              Hint
            </button>
            <button onClick={() => setShowMine((s) => !s)}>{showMine ? 'Hide my move' : 'My move'}</button>
            <button onClick={reveal}>Solution</button>
          </div>
        ) : (
          <div className="explain">
            <p>
              Best: <strong className="good-text">{move.bestSan}</strong> <span className="muted">{move.bestLineSan.slice(1, 7).join(' ')}</span>
            </p>
            <p>
              You played <strong className="bad-text">{move.san}</strong> → {formatEval(move.evalAfter)}
              {move.replySan && <span className="muted">, punished by {move.replySan}</span>}.
            </p>
            {move.reason && <p className="small">Why it went wrong: {move.reason}.</p>}
            <div className="chips static">
              {themes.map((t) => (
                <span key={t} className="chip on">{THEME_LABEL[t]}</span>
              ))}
              {tagsOf(move).map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
            <div className="row">
              <button className="primary" onClick={() => setI((x) => x + 1)}>
                Next →
              </button>
              <button className="link" onClick={() => onOpen(game.id)}>
                open game
              </button>
            </div>
          </div>
        )}
        <p className="tiny muted foot">Drag or click to move. A move within {TOLERANCE}% of the best also counts, checked by Stockfish.</p>
      </div>
    </div>
  );
}
