import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeGame } from './lib/analyze';
import { fetchArchives, fetchMonth } from './lib/chesscom';
import { getEngine } from './lib/engine';
import type { BlockId } from './lib/curriculum';
import { log, toggleBlock, type Progress, EMPTY_PROGRESS } from './lib/progress';
import { dueCards, grade, syncCards } from './lib/quiz';
import * as store from './lib/store';
import type { AnalyzedGame, QuizAttempt, QuizCard, RawGame, Settings } from './lib/types';
import { DEFAULT_SETTINGS } from './lib/types';
import GamesView from './components/GamesView';
import GameView from './components/GameView';
import MethodView from './components/MethodView';
import ProgressView from './components/ProgressView';
import SettingsPanel from './components/SettingsPanel';
import TodayView from './components/TodayView';
import TrainView, { type TrainMode } from './components/TrainView';

export type Tab = 'today' | 'games' | 'train' | 'progress' | 'method';
const AUTO_ANALYZE = 10;

export interface Job {
  gameId: string;
  done: number;
  total: number;
}

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '♔' },
  { id: 'games', label: 'My games', icon: '♙' },
  { id: 'train', label: 'Drills', icon: '♘' },
  { id: 'progress', label: 'Progress', icon: '♖' },
  { id: 'method', label: 'The method', icon: '♗' },
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [raw, setRaw] = useState<RawGame[]>([]);
  const [analyses, setAnalyses] = useState<AnalyzedGame[]>([]);
  const [cards, setCards] = useState<Record<string, QuizCard>>({});
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [openGame, setOpenGame] = useState<string | null>(null);
  const [trainMode, setTrainMode] = useState<TrainMode | null>(null);
  const [retryCard, setRetryCard] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const booted = useRef(false);

  const enqueue = useCallback((ids: string[]) => {
    setQueue((q) => [...q, ...ids.filter((id) => !q.includes(id))]);
  }, []);

  const sync = useCallback(
    async (s: Settings, known: Set<string>) => {
      setSyncing(true);
      setError(null);
      try {
        const archives = (await fetchArchives(s.username)).slice(-s.months);
        const current = archives[archives.length - 1];
        for (const url of archives) {
          if (url !== current && (await store.loadMonth(url))) continue;
          await store.saveMonth(url, await fetchMonth(url));
        }
        const all = await store.loadAllRaw();
        setRaw(all);
        // Coach reviews your latest games automatically.
        const fresh = all.filter((g) => s.timeClasses.includes(g.timeClass)).slice(0, AUTO_ANALYZE).filter((g) => !known.has(g.id));
        enqueue(fresh.map((g) => g.id));
      } catch (e) {
        setError(`Couldn't fetch games: ${(e as Error).message}`);
      } finally {
        setSyncing(false);
      }
    },
    [enqueue],
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      const s = await store.loadSettings();
      const an = await store.loadAllAnalyses();
      const c = syncCards(an, await store.loadQuiz());
      setSettings(s);
      setRaw(await store.loadAllRaw());
      setAnalyses(an);
      setCards(c);
      setProgress(await store.loadProgress());
      setLoaded(true);
      sync(s, new Set(an.map((a) => a.id)));
    })();
  }, [sync]);

  // Analysis loop: one game at a time through the shared engine.
  useEffect(() => {
    if (job || !queue.length) return;
    const id = queue[0];
    const game = raw.find((g) => g.id === id);
    if (!game) {
      setQueue((q) => q.slice(1));
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setJob({ gameId: id, done: 0, total: 1 });
    analyzeGame(game, settings.username, getEngine(), settings.depth, (done, total) => setJob({ gameId: id, done, total }), ac.signal)
      .then(async (a) => {
        await store.saveAnalysis(a);
        setAnalyses((xs) => [a, ...xs.filter((x) => x.id !== a.id)].sort((x, y) => y.endTime - x.endTime));
        setCards((c) => {
          const next = syncCards([a], c);
          store.saveQuiz(next);
          return next;
        });
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setError(`Analysis failed: ${(e as Error).message}`);
      })
      .finally(() => {
        setJob(null);
        setQueue((q) => q.filter((x) => x !== id));
      });
  }, [queue, job, raw, settings.username, settings.depth]);

  const stopQueue = () => {
    setQueue([]);
    abortRef.current?.abort();
  };

  /** Applies f to the latest copy of the game, so quick successive edits never overwrite each other. */
  const updateAnalysis = useCallback((id: string, f: (g: AnalyzedGame) => AnalyzedGame) => {
    setAnalyses((xs) =>
      xs.map((x) => {
        if (x.id !== id) return x;
        const next = f(x);
        store.saveAnalysis(next);
        return next;
      }),
    );
  }, []);

  const updateProgress = useCallback((f: (p: Progress) => Progress) => {
    setProgress((p) => {
      const next = f(p);
      store.saveProgress(next);
      return next;
    });
  }, []);

  const onTrainResult = useCallback(
    (card: QuizCard, attempt: QuizAttempt, mode: TrainMode) => {
      setCards((c) => {
        const next = { ...c, [card.id]: grade(c[card.id] ?? card, attempt) };
        store.saveQuiz(next);
        return next;
      });
      updateProgress((p) => log(p, mode === 'puzzles' ? { drills: 1, solved: attempt.hitBest ? 1 : 0 } : { think: 1 }));
    },
    [updateProgress],
  );

  const saveSettings = (s: Settings) => {
    setSettings(s);
    store.saveSettings(s);
  };

  const go = (t: Tab) => {
    setTab(t);
    setOpenGame(null);
    setTrainMode(null);
    setRetryCard(null);
  };

  const filtered = useMemo(() => analyses.filter((a) => settings.timeClasses.includes(a.timeClass)), [analyses, settings.timeClasses]);
  const analyzedIds = useMemo(() => new Set(analyses.map((a) => a.id)), [analyses]);
  const unanalyzed = raw.filter((g) => settings.timeClasses.includes(g.timeClass) && !analyzedIds.has(g.id)).length;
  const dueCount = dueCards(cards).length;
  const current = openGame ? analyses.find((a) => a.id === openGame) : undefined;
  const busy = syncing || !!job || queue.length > 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">♞</span>
          <div>
            <div className="title">Chess Aasaan</div>
            <div className="tiny muted">training for long games</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`navitem ${tab === n.id && !current ? 'active' : ''}`} onClick={() => go(n.id)}>
              <span className="navicon" aria-hidden>{n.icon}</span>
              <span className="navlabel">{n.label}</span>
              {n.id === 'train' && dueCount > 0 && <span className="pill">{dueCount}</span>}
            </button>
          ))}
          <button className="navitem" onClick={() => setShowSettings((s) => !s)}>
            <span className="navicon" aria-hidden>⚙</span>
            <span className="navlabel">Settings</span>
          </button>
        </nav>
        <div className="side-foot tiny muted">chess.com · {settings.username}</div>
      </aside>

      <div className="content">
        {showSettings && <SettingsPanel settings={settings} onChange={saveSettings} onClose={() => setShowSettings(false)} />}
        {error && (
          <div className="banner error" role="alert">
            {error} <button className="link" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}
        {(syncing || job || queue.length > 0) && (
          <div className="banner live">
            <span className="pulse" aria-hidden />
            {syncing && !job ? 'Fetching your games from chess.com…' : `Stockfish is checking ${queue.length} game${queue.length === 1 ? '' : 's'} (depth ${settings.depth})`}
            {job && <progress max={job.total} value={job.done} />}
            {queue.length > 0 && <button className="link" onClick={stopQueue}>stop</button>}
          </div>
        )}

        <main>
          {!loaded ? null : current ? (
            <GameView
              key={current.id}
              game={current}
              onBack={() => setOpenGame(null)}
              onChange={(f) => updateAnalysis(current.id, f)}
              onReviewed={() => updateProgress((p) => log(p, { reviews: 1 }))}
              onRetry={(id) => {
                setRetryCard(id);
                setOpenGame(null);
                setTab('train');
                setTrainMode('puzzles');
              }}
            />
          ) : tab === 'today' ? (
            <TodayView
              games={filtered}
              progress={progress}
              settings={settings}
              dueCount={dueCount}
              unanalyzed={unanalyzed}
              busy={busy}
              onOpen={setOpenGame}
              onTrain={(m) => {
                setTab('train');
                setTrainMode(m);
              }}
              onTab={go}
              onToggleBlock={(id: BlockId) => updateProgress((p) => toggleBlock(p, id))}
            />
          ) : tab === 'games' ? (
            <GamesView
              raw={raw}
              analyses={analyses}
              settings={settings}
              syncing={syncing}
              queue={queue}
              onSync={() => sync(settings, analyzedIds)}
              onAnalyze={enqueue}
              onOpen={setOpenGame}
              onSettings={saveSettings}
            />
          ) : tab === 'train' ? (
            <TrainView
              games={analyses}
              cards={cards}
              depth={settings.depth}
              mode={trainMode}
              startWith={retryCard}
              onMode={(m) => {
                setTrainMode(m);
                if (!m) setRetryCard(null);
              }}
              onResult={onTrainResult}
              onOpen={setOpenGame}
            />
          ) : tab === 'progress' ? (
            <ProgressView games={filtered} progress={progress} onOpen={setOpenGame} />
          ) : (
            <MethodView />
          )}
        </main>
      </div>
    </div>
  );
}
