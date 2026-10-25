import { useMemo } from 'react';
import { userMoves } from '../lib/analyze';
import { formatTimeControl } from '../lib/chesscom';
import type { AnalyzedGame, RawGame, Settings } from '../lib/types';

interface Props {
  raw: RawGame[];
  analyses: AnalyzedGame[];
  settings: Settings;
  syncing: boolean;
  queue: string[];
  onSync: () => void;
  onAnalyze: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onSettings: (s: Settings) => void;
}

const CLASSES = ['rapid', 'daily', 'blitz', 'bullet'];

function resultOf(g: RawGame, username: string) {
  const me = g.white.username.toLowerCase() === username.toLowerCase() ? g.white : g.black;
  const opp = me === g.white ? g.black : g.white;
  const r = me.result === 'win' ? 'win' : opp.result === 'win' ? 'loss' : 'draw';
  return { me, opp, r, color: me === g.white ? 'White' : 'Black' };
}

export default function GamesView({ raw, analyses, settings, syncing, queue, onSync, onAnalyze, onOpen, onSettings }: Props) {
  const byId = useMemo(() => new Map(analyses.map((a) => [a.id, a])), [analyses]);
  const games = raw.filter((g) => settings.timeClasses.includes(g.timeClass));
  const pending = games.filter((g) => !byId.has(g.id) && !queue.includes(g.id));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    raw.forEach((g) => m.set(g.timeClass, (m.get(g.timeClass) ?? 0) + 1));
    return m;
  }, [raw]);

  const toggleClass = (c: string) => {
    const has = settings.timeClasses.includes(c);
    onSettings({ ...settings, timeClasses: has ? settings.timeClasses.filter((x) => x !== c) : [...settings.timeClasses, c] });
  };

  return (
    <section>
      <div className="toolbar">
        <button className="primary" onClick={onSync} disabled={syncing}>
          {syncing ? 'Fetching…' : `Fetch games (${settings.months} mo)`}
        </button>
        <div className="chips" role="group" aria-label="Time class filter">
          {CLASSES.map((c) => (
            <button key={c} className={settings.timeClasses.includes(c) ? 'chip on' : 'chip'} onClick={() => toggleClass(c)}>
              {c} <span className="muted">{counts.get(c) ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button onClick={() => onAnalyze(pending.slice(0, 10).map((g) => g.id))} disabled={!pending.length}>
          Analyze next 10
        </button>
      </div>

      {!raw.length && (
        <div className="empty card">
          <p>No games yet. Hit <strong>Fetch games</strong> to pull your chess.com archive.</p>
          <p className="muted small">
            Coach's note: analyze your longest games first. Your 10+0 games tell me less about classical than one 30+20 game.
          </p>
        </div>
      )}

      <ul className="gamelist">
        {games.map((g) => {
          const { me, opp, r, color } = resultOf(g, settings.username);
          const a = byId.get(g.id);
          const ms = a ? userMoves(a) : [];
          const bl = ms.filter((m) => m.severity === 'blunder').length;
          const mi = ms.filter((m) => m.severity === 'mistake').length;
          const inQueue = queue.includes(g.id);
          return (
            <li key={g.id} className="gamerow">
              <span className={`res ${r}`}>{r === 'win' ? 'W' : r === 'loss' ? 'L' : 'D'}</span>
              <div className="grow">
                <div>
                  vs <strong>{opp.username}</strong> <span className="muted">({opp.rating})</span>
                </div>
                <div className="muted small">
                  {color} · {me.rating} · {formatTimeControl(g.timeControl)} {g.timeClass} ·{' '}
                  {new Date(g.endTime * 1000).toLocaleDateString()}
                </div>
              </div>
              {a ? (
                <>
                  <span className="small summary">
                    {bl > 0 && <span className="sev blunder">{bl} ??</span>}
                    {mi > 0 && <span className="sev mistake">{mi} ?</span>}
                    {!bl && !mi && <span className="muted">clean</span>}
                  </span>
                  <button onClick={() => onOpen(g.id)}>Review</button>
                </>
              ) : (
                <button onClick={() => onAnalyze([g.id])} disabled={inQueue}>
                  {inQueue ? 'Queued' : 'Analyze'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
