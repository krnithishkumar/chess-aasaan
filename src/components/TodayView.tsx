import { useMemo } from 'react';
import { userMoves } from '../lib/analyze';
import { formatTimeControl } from '../lib/chesscom';
import { dailyPlan, type Block, type BlockId } from '../lib/curriculum';
import { coachAdvice, computePatterns } from '../lib/patterns';
import { dayLog, type Progress } from '../lib/progress';
import type { AnalyzedGame, Settings } from '../lib/types';
import type { Tab } from '../App';
import type { TrainMode } from './TrainView';

interface Props {
  games: AnalyzedGame[];
  progress: Progress;
  settings: Settings;
  dueCount: number;
  unanalyzed: number;
  busy: boolean;
  onOpen: (gameId: string) => void;
  onTrain: (m: TrainMode) => void;
  onTab: (t: Tab) => void;
  onToggleBlock: (id: BlockId) => void;
}

const DRILL_TARGET = 10;
const THINK_TARGET = 3;

export default function TodayView({ games, progress, settings, dueCount, unanalyzed, busy, onOpen, onTrain, onTab, onToggleBlock }: Props) {
  const patterns = useMemo(() => computePatterns(games), [games]);
  const { advice, warnings } = useMemo(() => coachAdvice(patterns), [patterns]);
  const plan = useMemo(() => dailyPlan(settings.hoursPerDay, advice.map((a) => a.tag)), [settings.hoursPerDay, advice]);
  const day = dayLog(progress);
  const toReview = games.filter((g) => g.review?.stage !== 'done');
  const nextReview = toReview[0];
  const rules = games.filter((g) => g.review?.lesson).slice(0, 6);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const status = (b: Block): { done: boolean; detail?: string } => {
    if (b.id === 'tactics') return { done: day.drills >= DRILL_TARGET || day.blocks.includes(b.id), detail: `${day.drills}/${DRILL_TARGET} drills today` };
    if (b.id === 'calculation') return { done: day.think >= THINK_TARGET || day.blocks.includes(b.id), detail: `${day.think}/${THINK_TARGET} positions today` };
    if (b.id === 'review') return { done: day.reviews >= 1 || day.blocks.includes(b.id) };
    return { done: day.blocks.includes(b.id) };
  };

  const action = (b: Block) => {
    if (b.tool === 'drills')
      return (
        <button className="primary" onClick={() => onTrain('puzzles')}>
          Start drills{dueCount ? ` (${dueCount} due)` : ''}
        </button>
      );
    if (b.tool === 'think')
      return (
        <button className="primary" onClick={() => onTrain('think')}>
          Open Think trainer
        </button>
      );
    if (b.tool === 'review' && nextReview)
      return (
        <button className="primary" onClick={() => onOpen(nextReview.id)}>
          Review vs {nextReview.opponent}
        </button>
      );
    return null;
  };

  return (
    <section className="today">
      <header className="page-head">
        <div>
          <div className="eyebrow">{date}</div>
          <h1>Today's training</h1>
          <p className="lede">
            {settings.hoursPerDay} hours, split the way the method suggests
            {advice.length ? ', with extra time on what your games show you need most.' : '.'}
          </p>
        </div>
      </header>

      {!games.length && (
        <div className="panel welcome">
          <h2>Getting started</h2>
          <p>
            {busy
              ? 'Your games are being fetched from chess.com and checked by Stockfish. The first results appear in a minute or two.'
              : 'No analysed games yet. Open My games and analyse a few, longest time control first.'}
          </p>
          <p className="muted">
            Meanwhile, read <button className="link" onClick={() => onTab('method')}>The method</button>: how to think on every move, how to review a game, and
            why the plan below looks the way it does.
          </p>
        </div>
      )}

      {warnings.map((w) => (
        <div key={w} className="note">
          {w}
        </div>
      ))}

      {advice.length > 0 && (
        <div className="panel focus-card">
          <div className="eyebrow">What your games say</div>
          <h2>{advice[0].headline}</h2>
          <p>{advice[0].drill}</p>
          <p className="small muted">
            Evidence: {advice[0].evidence} {advice[0].trend}
          </p>
          {advice[1] && (
            <p className="small">
              Second priority: <strong>{advice[1].tag}</strong>. {advice[1].headline}
            </p>
          )}
        </div>
      )}

      <h2>The session</h2>
      <ol className="plan">
        {plan.map((b) => {
          const s = status(b);
          return (
            <li key={b.id} className={`plan-item ${s.done ? 'done' : ''}`}>
              <button
                className="tick"
                role="checkbox"
                aria-checked={s.done}
                aria-label={`Mark ${b.title} done`}
                onClick={() => onToggleBlock(b.id)}
              >
                {s.done ? '✓' : ''}
              </button>
              <div className="plan-body">
                <div className="plan-title">
                  <strong>{b.title}</strong>
                  <span className="mins">{b.minutes} min</span>
                  {b.focus && <span className="badge">your focus</span>}
                </div>
                <p>{b.what}</p>
                <p className="small muted">Why: {b.why}</p>
                {s.detail && <p className="small">{s.detail}</p>}
              </div>
              <div className="plan-action">{action(b)}</div>
            </li>
          );
        })}
      </ol>
      {unanalyzed > 0 && (
        <p className="small muted">
          {unanalyzed} games not analysed yet. <button className="link" onClick={() => onTab('games')}>Analyse them</button> to sharpen the plan.
        </p>
      )}

      <div className="grid2">
        <div className="panel">
          <h3>Your rules</h3>
          <p className="small muted">One sentence from each game you review. Read them before you play.</p>
          {rules.length ? (
            <ul className="rules">
              {rules.map((g) => (
                <li key={g.id}>
                  <span>{g.review!.lesson}</span>
                  <button className="link small" onClick={() => onOpen(g.id)}>
                    vs {g.opponent}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">None yet. Finish a game review to write your first rule.</p>
          )}
        </div>

        <div className="panel">
          <h3>Waiting for your review</h3>
          <p className="small muted">Longest games first teach the most about classical play.</p>
          {toReview.length ? (
            <ul className="mini-games">
              {[...toReview]
                .sort((a, b) => b.baseSeconds - a.baseSeconds || b.endTime - a.endTime)
                .slice(0, 5)
                .map((g) => {
                  const errs = userMoves(g).filter((m) => m.severity === 'mistake' || m.severity === 'blunder').length;
                  return (
                    <li key={g.id}>
                      <span className={`res ${g.result}`}>{g.result === 'win' ? 'W' : g.result === 'loss' ? 'L' : 'D'}</span>
                      <span className="grow">
                        vs {g.opponent} <span className="muted small">· {formatTimeControl(g.timeControl)}</span>
                      </span>
                      <span className="muted small">{errs ? `${errs} error${errs === 1 ? '' : 's'}` : 'clean'}</span>
                      <button onClick={() => onOpen(g.id)}>Review</button>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="muted">All analysed games are reviewed.</p>
          )}
        </div>
      </div>
    </section>
  );
}
