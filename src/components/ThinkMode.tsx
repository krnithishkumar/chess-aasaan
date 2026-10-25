import { useEffect, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { evalToCp, fmtClock, formatEval, winPct } from '../lib/analyze';
import { THINKING_STEPS } from '../lib/curriculum';
import { getEngine } from '../lib/engine';
import { findMove, parseCandidates } from '../lib/quiz';
import type { AnalyzedGame, Eval, QuizAttempt, QuizCard } from '../lib/types';
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

/** A candidate within this many win% points of the position's value counts as a good move. */
const TOLERANCE = 3;

interface Checked {
  san: string;
  uci: string;
  eval?: Eval;
  /** Win% you lose with this move, from your side. */
  loss?: number;
}

/** Classical thinking practice: the 5-step check on a position from your games, then Stockfish checks every candidate. */
export default function ThinkMode({ games, deck: liveDeck, depth, onResult, onOpen, onExit }: Props) {
  // Freeze the session: grading re-sorts the live deck, which would swap the position mid-reveal.
  const [deck] = useState(() => liveDeck);
  const [idx, setIdx] = useState(0);
  const [threat, setThreat] = useState('');
  const [forcing, setForcing] = useState('');
  const [cands, setCands] = useState('');
  const [choice, setChoice] = useState('');
  const [check, setCheck] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<Checked[]>([]);
  const [started, setStarted] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [thinkTime, setThinkTime] = useState(0);
  const [graded, setGraded] = useState<QuizAttempt['grade'] | null>(null);

  const card = deck[idx];
  const found = card ? findMove(games, card) : undefined;

  useEffect(() => {
    setStarted(Date.now());
    setThreat('');
    setForcing('');
    setCands('');
    setChoice('');
    setCheck('');
    setRevealed(false);
    setChecked([]);
    setGraded(null);
  }, [card?.id]);
  useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [revealed]);

  if (!found)
    return (
      <div className="panel empty">
        <h2>{deck.length ? 'Done for now' : 'No positions yet'}</h2>
        <p className="muted">The Think trainer uses the critical positions from your analysed games. Analyse more games to get more.</p>
        <button onClick={onExit}>Back to drills</button>
      </div>
    );

  const { game, move } = found;
  const parsed = parseCandidates(move.fenBefore, cands);
  const chosen = parsed.find((p) => p.uci === choice) ?? (parsed.length === 1 ? parsed[0] : undefined);
  const best = move.evalBefore.best!;
  const elapsed = Math.floor(((revealed ? started + thinkTime * 1000 : now) - started) / 1000);
  const ready = threat.trim() && parsed.length > 0 && chosen && check.trim();
  const mover = move.color === 'w' ? 'White' : 'Black';

  const reveal = async () => {
    if (!chosen) return;
    setThinkTime(Math.floor((Date.now() - started) / 1000));
    setRevealed(true);
    const engine = getEngine();
    const results: Checked[] = parsed.map((p) => ({ ...p }));
    setChecked([...results]);
    for (let i = 0; i < results.length; i++) {
      const c = new Chess(move.fenBefore);
      c.move({ from: results[i].uci.slice(0, 2), to: results[i].uci.slice(2, 4), promotion: results[i].uci[4] });
      const e = results[i].uci === best ? move.evalBefore : await engine.evaluate(c.fen(), depth);
      const w = winPct(evalToCp(e));
      results[i] = { ...results[i], eval: e, loss: Math.max(0, move.winBefore - (move.color === 'w' ? w : 100 - w)) };
      setChecked([...results]);
    }
    const ok = (r?: Checked) => r?.loss !== undefined && r.loss <= TOLERANCE;
    const grade: QuizAttempt['grade'] = ok(results.find((r) => r.uci === chosen.uci)) ? 'got' : results.some(ok) ? 'partial' : 'missed';
    setGraded(grade);
    onResult(card, {
      at: Date.now(),
      plan: [threat, forcing, check].join('\n'),
      candidates: parsed.map((p) => p.san),
      hitBest: chosen.uci === best,
      grade,
    });
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

  const field = (n: number, value: string, set: (v: string) => void, placeholder: string, multiline = true) => (
    <label className="think-step">
      <span className="step-n">{n + 1}</span>
      <span className="grow">
        <strong>{THINKING_STEPS[n].title}</strong> <span className="muted small">{THINKING_STEPS[n].text}</span>
        {multiline ? (
          <textarea value={value} onChange={(e) => set(e.target.value)} disabled={revealed} placeholder={placeholder} rows={2} />
        ) : (
          <input value={value} onChange={(e) => set(e.target.value)} disabled={revealed} placeholder={placeholder} />
        )}
      </span>
    </label>
  );

  return (
    <div className="trainer">
      <div className="trainer-board">
        <div className="puzzle-head">
          <span className="eyebrow">Think trainer · {deck.length - idx} left</span>
          <span className={`thinkclock ${elapsed > 900 ? 'slow' : ''}`} aria-label="Time spent">
            {fmtClock(elapsed)}
          </span>
        </div>
        <Board
          fen={move.fenBefore}
          orientation={move.color === 'w' ? 'white' : 'black'}
          arrows={revealed ? [uciArrow(move.uci, ARROW.played), uciArrow(best, ARROW.best)] : []}
          onMove={revealed ? undefined : onMove}
        />
        <p className="tiny muted center">Drag a piece to add it as a candidate. The board doesn't change.</p>
      </div>

      <div className="trainer-side panel">
        <div className="eyebrow">
          vs {game.opponent} · move {move.moveNo} · {mover} to move
        </div>
        <h2 className="prompt">Find the best move, slowly</h2>
        <p className="muted small">Take 5-10 minutes, as you would at a critical moment in a classical game. Writing it down is the practice.</p>

        {field(0, threat, setThreat, 'Their last move attacks… / threatens… / stopped defending…')}
        {field(1, forcing, setForcing, 'Mine: Bxf7+, Nxe5… Theirs: …Qb6 hits b2')}
        <label className="think-step">
          <span className="step-n">3</span>
          <span className="grow">
            <strong>{THINKING_STEPS[2].title}</strong> <span className="muted small">{THINKING_STEPS[2].text}</span>
            <input value={cands} onChange={(e) => setCands(e.target.value)} disabled={revealed} placeholder="Nxe5, Qh5, O-O" />
            {cands && <span className="small muted">Understood as: {parsed.map((p) => p.san).join(', ') || 'no legal moves yet'}</span>}
          </span>
        </label>
        <div className="think-step">
          <span className="step-n">4</span>
          <span className="grow">
            <strong>{THINKING_STEPS[3].title}</strong> <span className="muted small">{THINKING_STEPS[3].text} Then choose:</span>
            <div className="chips">
              {parsed.map((p) => (
                <button key={p.uci} className={chosen?.uci === p.uci ? 'chip on' : 'chip'} onClick={() => setChoice(p.uci)} disabled={revealed}>
                  {p.san}
                </button>
              ))}
              {!parsed.length && <span className="small muted">Add candidates first.</span>}
            </div>
          </span>
        </div>
        {field(4, check, setCheck, 'After my move, their most dangerous reply is… and I answer with…')}

        {!revealed ? (
          <div className="row">
            <button className="primary" onClick={reveal} disabled={!ready}>
              Play {chosen ? chosen.san : 'move'} and check
            </button>
            <button className="link" onClick={() => setIdx((x) => x + 1)}>
              skip
            </button>
            {!ready && <span className="tiny muted">Fill in steps 1, 3, 4 and 5 first.</span>}
          </div>
        ) : (
          <div className="explain">
            {graded && (
              <div className={`feedback ${graded === 'got' ? 'ok' : graded === 'partial' ? 'warn' : 'miss'}`} role="status">
                {graded === 'got'
                  ? `Good move. ${chosen!.san} keeps the position's value.`
                  : graded === 'partial'
                    ? 'You had a good move among your candidates but chose another. Compare your calculation of the two.'
                    : 'None of your candidates held the position. Look at the engine move: why was it not on your list?'}
              </div>
            )}
            <h4>Your candidates (Stockfish depth {depth})</h4>
            <ul className="plain cands">
              {checked.map((c) => (
                <li key={c.uci}>
                  <strong>{c.san}</strong>
                  {c.uci === chosen?.uci && <span className="badge">your choice</span>}
                  <span className="muted">
                    {c.eval ? `${formatEval(c.eval)} · ${c.loss! <= TOLERANCE ? 'good' : `loses ${Math.round(c.loss!)}% winning chances`}` : 'checking…'}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Engine: <strong className="good-text">{move.bestSan}</strong> ({formatEval(move.evalBefore)}){' '}
              <span className="muted small">{move.bestLineSan.slice(1, 7).join(' ')}</span>
            </p>
            <p>
              In the game you played <strong className="bad-text">{move.san}</strong> in {move.timeSpent !== undefined ? fmtClock(move.timeSpent) : '?'}
              {move.replySan && <>, and the punishment was <strong>{move.replySan}</strong></>}. Did your blunder check see that kind of reply?
            </p>
            <p className="small muted">
              Today you took {fmtClock(thinkTime)}. Type of mistake: {tagsOf(move).join(', ')}.
            </p>
            <div className="row">
              <button className="primary" onClick={() => setIdx((x) => x + 1)}>
                Next position →
              </button>
              <button className="link" onClick={() => onOpen(game.id)}>
                open the game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
