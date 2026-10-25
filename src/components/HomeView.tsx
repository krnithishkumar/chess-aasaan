import { useMemo } from 'react';
import { userMoves } from '../lib/analyze';
import { dailyMission, hqMessage, type Mission } from '../lib/coach';
import { playerDna } from '../lib/insights';
import { level, streak, type Progress } from '../lib/progress';
import type { AnalyzedGame } from '../lib/types';
import Radar from './Radar';

interface Props {
  games: AnalyzedGame[];
  progress: Progress;
  dueCount: number;
  unanalyzed: number;
  daysLeft: number;
  busy: boolean;
  onAction: (a: Mission['action'] | 'open', gameId?: string) => void;
}

export default function HomeView({ games, progress, dueCount, unanalyzed, daysLeft, busy, onAction }: Props) {
  const dna = useMemo(() => playerDna(games), [games]);
  const streakDays = streak(progress);
  const lvl = level(progress.xp);
  const missions = useMemo(() => dailyMission(games, progress, dueCount, unanalyzed), [games, progress, dueCount, unanalyzed]);
  const message = useMemo(() => hqMessage(games, dna, daysLeft, streakDays), [games, dna, daysLeft, streakDays]);
  const totalDays = 64;
  const ring = Math.max(0, Math.min(1, 1 - daysLeft / totalDays));

  return (
    <section className="hq">
      <div className="hero">
        <div className="countdown">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" className="ring-bg" />
            <circle cx="60" cy="60" r="52" className="ring-fg" strokeDasharray={`${ring * 326.7} 326.7`} transform="rotate(-90 60 60)" />
          </svg>
          <div className="countdown-v">
            <div className="big">{daysLeft}</div>
            <div className="muted small">days</div>
          </div>
        </div>
        <div className="hero-text">
          <div className="eyebrow">Madurai · FIDE Classical · Cat E · Dec 29-31</div>
          <h1>Coach's briefing</h1>
          <p className="coach-says">
            <span className="coach-badge" aria-hidden>♚</span>
            {busy && !games.length ? 'Pulling your games and running Stockfish on the latest ones. First verdicts in a minute…' : message}
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <div className="stat-v">🔥 {streakDays}</div>
            <div className="stat-l">day streak</div>
          </div>
          <div className="stat">
            <div className="stat-v gold">{progress.xp} XP</div>
            <div className="stat-l">{lvl.name}</div>
            <div className="xpbar" aria-label={`${Math.round(lvl.progress * 100)}% to ${lvl.next}`}>
              <span style={{ width: `${lvl.progress * 100}%` }} />
            </div>
            {lvl.next && <div className="stat-l tiny">{lvl.toNext} XP to {lvl.next}</div>}
          </div>
        </div>
      </div>

      <div className="hq-grid">
        <div className="panel">
          <h2>Today's mission</h2>
          <ol className="missions">
            {missions.map((m) => {
              const done = m.done >= m.target;
              return (
                <li key={m.id} className={done ? 'done' : ''}>
                  <span className="check" aria-hidden>{done ? '✓' : ''}</span>
                  <div className="grow">
                    <div className="m-title">{m.title}</div>
                    <div className="muted small">{m.detail}</div>
                    {m.target > 1 && (
                      <div className="mbar">
                        <span style={{ width: `${Math.min(1, m.done / m.target) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  {!done && (
                    <button className="primary" onClick={() => onAction(m.action)}>
                      {m.action === 'puzzles' ? 'Train' : m.action === 'think' ? 'Think' : m.action === 'review' ? 'Review' : 'Analyze'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="panel">
          <h2>Player DNA</h2>
          {games.length ? <Radar axes={dna} /> : <p className="muted">Appears after your first analyzed games.</p>}
        </div>
      </div>

      {games.length > 0 && (
        <div className="panel">
          <h2>Recent games</h2>
          <div className="strip">
            {games.slice(0, 12).map((g) => {
              const ms = userMoves(g);
              const bl = ms.filter((m) => m.severity === 'blunder').length;
              const mi = ms.filter((m) => m.severity === 'mistake').length;
              return (
                <button key={g.id} className={`gcard ${g.result}`} onClick={() => onAction('open', g.id)}>
                  <div className="gcard-r">{g.result === 'win' ? 'WIN' : g.result === 'loss' ? 'LOSS' : 'DRAW'}</div>
                  <div className="gcard-o">{g.opponent}</div>
                  <div className="tiny muted">{g.opponentRating} · {g.userColor === 'w' ? 'White' : 'Black'}</div>
                  <div className="gcard-s">
                    {bl > 0 && <span className="sev blunder">{bl}??</span>}
                    {mi > 0 && <span className="sev mistake">{mi}?</span>}
                    {!bl && !mi && <span className="sev good">clean</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
