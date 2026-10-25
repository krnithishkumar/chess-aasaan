import { useMemo, useState } from 'react';
import { userMoves } from '../lib/analyze';
import { dueCards, findMove } from '../lib/quiz';
import { THEME_LABEL, themesOf, type Theme } from '../lib/themes';
import type { AnalyzedGame, QuizAttempt, QuizCard, Tag } from '../lib/types';
import { TAGS, tagsOf } from '../lib/types';
import BlunderBook from './BlunderBook';
import ThinkMode from './ThinkMode';

export type TrainMode = 'puzzles' | 'think';

interface Props {
  games: AnalyzedGame[];
  cards: Record<string, QuizCard>;
  depth: number;
  mode: TrainMode | null;
  startWith: string | null;
  onMode: (m: TrainMode | null) => void;
  onResult: (card: QuizCard, attempt: QuizAttempt, xp: number, mode: TrainMode) => void;
  onOpen: (gameId: string) => void;
}

type Focus = { kind: 'all' } | { kind: 'tag'; tag: Tag } | { kind: 'theme'; theme: Theme };

export default function TrainView({ games, cards, depth, mode, startWith, onMode, onResult, onOpen }: Props) {
  const [focus, setFocus] = useState<Focus>({ kind: 'all' });
  const [sessionKey, setSessionKey] = useState(0);
  const all = Object.values(cards);

  const matches = (c: QuizCard) => {
    if (focus.kind === 'all') return true;
    const f = findMove(games, c);
    if (!f) return false;
    return focus.kind === 'tag' ? tagsOf(f.move).includes(focus.tag) : themesOf(f.move).includes(focus.theme);
  };

  const deck = useMemo(() => {
    let d = dueCards(cards).filter(matches);
    // Nothing due: practice the least-mastered ones anyway.
    if (!d.length) d = all.filter(matches).sort((a, b) => a.box - b.box);
    if (startWith && cards[startWith]) d = [cards[startWith], ...d.filter((c) => c.id !== startWith)];
    return d.filter((c) => findMove(games, c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, games, focus, startWith, sessionKey]);

  const themeOptions = useMemo(() => {
    const m = new Map<Theme, number>();
    for (const g of games)
      for (const mv of userMoves(g))
        if (mv.severity === 'mistake' || mv.severity === 'blunder') for (const t of themesOf(mv)) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [games]);

  if (mode) {
    const Comp = mode === 'puzzles' ? BlunderBook : ThinkMode;
    return (
      <Comp
        key={`${mode}-${sessionKey}-${startWith}`}
        games={games}
        deck={deck}
        depth={depth}
        onResult={(c, a, xp) => onResult(c, a, xp, mode)}
        onOpen={onOpen}
        onExit={() => {
          setSessionKey((k) => k + 1);
          onMode(null);
        }}
      />
    );
  }

  const due = dueCards(cards).length;
  const mastered = all.filter((c) => c.box >= 3).length;
  const focusKey = focus.kind === 'all' ? 'all' : focus.kind === 'tag' ? `tag:${focus.tag}` : `theme:${focus.theme}`;

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Train</div>
          <h1>Your blunders, turned into homework</h1>
        </div>
      </div>
      <div className="deckstats">
        <div><span className="big">{all.length}</span> positions</div>
        <div><span className="big gold">{due}</span> due today</div>
        <div><span className="big">{mastered}</span> mastered</div>
      </div>

      <label className="focus">
        Focus
        <select
          value={focusKey}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'all') setFocus({ kind: 'all' });
            else if (v.startsWith('tag:')) setFocus({ kind: 'tag', tag: v.slice(4) as Tag });
            else setFocus({ kind: 'theme', theme: v.slice(6) as Theme });
          }}
        >
          <option value="all">Everything due</option>
          <optgroup label="Mistake type">
            {TAGS.map((t) => (
              <option key={t} value={`tag:${t}`}>{t}</option>
            ))}
          </optgroup>
          <optgroup label="Tactical theme">
            {themeOptions.map(([t, n]) => (
              <option key={t} value={`theme:${t}`}>
                {THEME_LABEL[t]} ({n})
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="modes">
        <button className="mode-card" onClick={() => onMode('puzzles')} disabled={!deck.length}>
          <div className="mode-icon">♞</div>
          <h2>Blunder Book</h2>
          <p>Play the move you should have played. Hint, My Move, Solution. 10 positions per session, and the misses come back sooner.</p>
          <span className="mode-meta">{deck.length ? `${Math.min(10, deck.length)} ready · up to 15 XP each` : 'Nothing to train yet'}</span>
        </button>
        <button className="mode-card" onClick={() => onMode('think')} disabled={!deck.length}>
          <div className="mode-icon">⏱</div>
          <h2>Classical think</h2>
          <p>A clock runs. Write a plan and your candidates like it's 90+30, then Stockfish judges each candidate. Your real gap.</p>
          <span className="mode-meta">{deck.length ? 'up to 20 XP each' : 'Nothing to train yet'}</span>
        </button>
      </div>
    </section>
  );
}
