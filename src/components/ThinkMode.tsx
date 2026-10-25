import { useEffect, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { fmtClock, formatEval } from '../lib/analyze';
import { getEngine } from '../lib/engine';
import { findMove, parseCandidates } from '../lib/quiz';
import type { AnalyzedGame, Eval, QuizAttempt, QuizCard } from '../lib/types';
import { tagsOf } from '../lib/types';
import Board, { ARROW, uciArrow } from './Board';

interface Props {
  games: AnalyzedGame[];
  deck: QuizCard[];
  depth: number;
  onResult: (card: QuizCard, attempt: QuizAttempt, xp: number) => void;
  onOpen: (gameId: string) => void;
  onExit: () => void;
}

/** Classical OTB simulation: plan + candidates on a running clock, then the engine judges every candidate. */
export default function ThinkMode({ games, deck, depth, onResult, onOpen, onExit }: Props) {
  const [idx, setIdx] = useState(0);
  const [plan, setPlan] = useState('');
  const [cands, setCands] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [candEvals, setCandEvals] = useState<{ san: string; uci: string; eval?: Eval }[]>([]);
  const [started, setStarted] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [thinkTime, setThinkTime] = useState(0);

  const card = deck[idx];
  const found = card ? findMove(games, card) : undefined;

  useEffect(() => {
    setStarted(Date.now());
    setPlan('');
    setCands('');
    setRevealed(false);
    setCandEvals([]);
  }, [card?.id]);
  useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [revealed]);

  if (!found)
    return (
      <div className="panel empty">
        <h2>{deck.length ? 'Done for now' : 'No positions due'}</h2>
        <p className="muted">Classical-think uses the same positions as Blunder Book. Analyze more games to get more.</p>
        <button onClick={onExit}>Back</button>
      </div>
    );

  const { game, move } = found;
  const parsed = parseCandidates(move.fenBefore, cands);
  const best = move.evalBefore.best!;
  const elapsed = Math.floor(((revealed ? started + thinkTime * 1000 : now) - started) / 1000);
  // Classical target: a critical position deserves real time, but not half your clock.
  const clockClass = elapsed < 120 ? 'fast' : elapsed < 900 ? 'good' : 'slow';

  const reveal = async () => {
    setThinkTime(Math.floor((Date.now() - started) / 1000));
    setRevealed(true);
    const engine = getEngine();
    const results: { san: string; uci: string; eval?: Eval }[] = parsed.map((p) => ({ ...p }));
    setCandEvals(results);
    for (let i = 0; i < results.length; i++) {
      const c = new Chess(move.fenBefore);
      c.move({ from: results[i].uci.slice(0, 2), to: results[i].uci.slice(2, 4), promotion: results[i].uci[4] });
      results[i] = { ...results[i], eval: await engine.evaluate(c.fen(), depth) };
      setCandEvals([...results]);
    }
  };

  const submit = (grade: QuizAttempt['grade']) => {
    onResult(
      card,
      { at: Date.now(), plan, candidates: parsed.map((p) => p.san), hitBest: parsed.some((p) => p.uci === best), grade },
      grade === 'got' ? 20 : grade === 'partial' ? 10 : 3,
    );
    setIdx((x) => x + 1);
  };

  const onMove = (from: Square, to: Square) => {
    const c = new Chess(move.fenBefore);
    try {
      const m = c.move({ from, to, promotion: 'q' });
      setCands((s) => (s.trim() ? `${s.trim()}, ${m.san}` : m.san));
    } catch {
      /* illegal */
    }
    return false;
  };

  return (
    <div className="trainer">
      <div className="trainer-board">
        <div className="puzzle-head">
          <span className="eyebrow">Classical think · {deck.length - idx} left</span>
          <span className={`thinkclock ${clockClass}`} aria-label="Think time">
            ⏱ {fmtClock(elapsed)}
          </span>
        </div>
        <Board
          fen={move.fenBefore}
          orientation={move.color === 'w' ? 'white' : 'black'}
          arrows={revealed ? [uciArrow(move.uci, ARROW.played), uciArrow(best, ARROW.best)] : []}
          onMove={revealed ? undefined : onMove}
        />
      </div>

      <div className="trainer-side panel">
        <div className="eyebrow">
          vs {game.opponent} · move {move.moveNo} · {move.color === 'w' ? 'White' : 'Black'} to move
        </div>
        <h2 className="prompt">Think like it's 90+30</h2>
        <p className="muted small">Take your time. In classical, a position like this deserves 5-15 minutes. Writing the line down is the training.</p>
        <label>
          1. Plan: what is this position about?
          <textarea value={plan} onChange={(e) => setPlan(e.target.value)} disabled={revealed} placeholder="Imbalances, weaknesses, what both sides want…" />
        </label>
        <label>
          2. Candidates (type or drag on the board)
          <input value={cands} onChange={(e) => setCands(e.target.value)} disabled={revealed} placeholder="Nxe5, Qh5, O-O" />
        </label>
        {cands && <p className="small muted">Parsed: {parsed.map((p) => p.san).join(', ') || 'nothing legal yet'}</p>}

        {!revealed ? (
          <div className="row">
            <button className="primary" onClick={reveal} disabled={!plan.trim() || !parsed.length}>
              Commit &amp; reveal
            </button>
            <button className="link" onClick={() => setIdx((x) => x + 1)}>
              skip
            </button>
            {(!plan.trim() || !parsed.length) && <span className="tiny muted">Plan + at least one candidate. No peeking.</span>}
          </div>
        ) : (
          <div className="explain">
            <p>
              Engine: <strong className="good-text">{move.bestSan}</strong> ({formatEval(move.evalBefore)}){' '}
              <span className="muted small">{move.bestLineSan.slice(1, 7).join(' ')}</span>
            </p>
            <p>
              Game: <strong className="bad-text">{move.san}</strong> ({formatEval(move.evalAfter)}), {move.severity}, played in{' '}
              {move.timeSpent !== undefined ? fmtClock(move.timeSpent) : '?'}. Today you thought for {fmtClock(thinkTime)}.
            </p>
            <h4>Your candidates (Stockfish d{depth})</h4>
            <ul className="plain">
              {candEvals.map((c) => (
                <li key={c.uci}>
                  {c.uci === best ? '✅' : c.uci === move.uci ? '❌' : '·'} {c.san} <span className="muted">{c.eval ? formatEval(c.eval) : 'evaluating…'}</span>
                </li>
              ))}
            </ul>
            <p className="tiny muted">Tags: {tagsOf(move).join(', ')}</p>
            <div className="row">
              <span className="small">Grade yourself:</span>
              <button onClick={() => submit('got')}>Got it</button>
              <button onClick={() => submit('partial')}>Right idea</button>
              <button onClick={() => submit('missed')}>Missed</button>
              <button className="link" onClick={() => onOpen(game.id)}>
                open game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
