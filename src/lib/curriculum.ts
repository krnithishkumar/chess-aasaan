import type { Tag } from './types';

/**
 * The training method, in one place. Everything here comes from established coaching practice:
 * - Charness et al. 2005: serious solo study is the strongest predictor of chess skill.
 * - Dvoretsky & Yusupov, "Training for the Tournament Player": analyse your own games before the engine.
 * - Heisman, "Real Chess" vs "Hope Chess": safety-check every move for checks, captures and threats.
 * - Kotov, "Think Like a Grandmaster": candidate moves, each line calculated once.
 * - Smith & Tikkanen, "The Woodpecker Method": repeat the same positions until the pattern is automatic.
 */

export interface Step {
  title: string;
  text: string;
}

/** Ask these on every move in a long game. The Think trainer walks through them. */
export const THINKING_STEPS: Step[] = [
  { title: 'What changed?', text: "Look at your opponent's last move. What does it attack, threaten, or stop defending?" },
  { title: 'Forcing moves', text: 'List every check, capture and threat, for you and for your opponent.' },
  { title: 'Candidates', text: "Pick 2-3 moves worth calculating. If no forcing move works, include a quiet improving move." },
  { title: 'Calculate', text: 'Follow each candidate until the position goes quiet. Go through each line once, then compare.' },
  { title: 'Blunder check', text: "Before you touch a piece: after my move, what is their most dangerous check, capture or threat? Can I meet it?" },
];

/** How to review one of your games (Yusupov's method). */
export const REVIEW_STEPS: Step[] = [
  { title: 'Replay it yourself', text: 'No engine yet. Play through the game and mark the 2-5 moments where it turned, or where you thought long.' },
  { title: 'Write your thoughts', text: 'At each moment, write what you were thinking and what you were afraid of. Be honest, nobody else reads it.' },
  { title: 'Then the engine', text: 'Compare. Which turning points did you see, and which did you miss completely? The misses are what to train.' },
  { title: 'One rule', text: 'Write one sentence you will apply in your next game. It goes on your list of rules.' },
];

/** Time plan for a 90+30 classical game. Fractions are of the base time, so they scale to other controls. */
export const TIME_CHECKPOINTS = [
  { move: 20, minPct: 0.6, label: 'Move 20', classical: '55+ min' },
  { move: 30, minPct: 0.33, label: 'Move 30', classical: '30+ min' },
  { move: 40, minPct: 0.11, label: 'Move 40', classical: '10+ min' },
];

export const TIME_PLAN: Step[] = [
  { title: 'Opening (moves 1-12)', text: 'About 1 minute a move while you are in lines you know. Spend real time the moment you are out of them.' },
  { title: 'Ordinary moves', text: '2-4 minutes. Run the blunder check, then play.' },
  { title: 'Critical moments', text: '10-20 minutes: piece sacrifices, captures that change the pawn structure, trading into an endgame, or when your plan has to change.' },
  { title: 'Avoid Kotov syndrome', text: "If you have calculated a long time and nothing works, don't play a third move you haven't checked. Pick the best of the lines you did calculate." },
  { title: 'With little time left', text: 'Under 5 minutes, use the 30-second increment. Simple safe moves, blunder check only.' },
];

export type BlockId = 'tactics' | 'calculation' | 'endgame' | 'review' | 'games' | 'openings';

export interface Block {
  id: BlockId;
  title: string;
  /** Minutes in a 4-hour day before adapting to your weaknesses. */
  minutes: number;
  what: string;
  why: string;
  /** Where in the app you do it, if anywhere. */
  tool?: 'drills' | 'think' | 'review';
}

export const BLOCKS: Block[] = [
  {
    id: 'tactics',
    title: 'Tactics',
    minutes: 40,
    what: 'Mistake drills from your own games first, then a fixed tactics set (e.g. The Woodpecker Method). Repeat the same set until you solve it fast.',
    why: 'Pattern recognition is built by repetition. Your own mistakes are the patterns you actually miss.',
    tool: 'drills',
  },
  {
    id: 'calculation',
    title: 'Calculation',
    minutes: 50,
    what: 'Think trainer positions, or hard exercises from a book. Full line written down before you check. 10-minute cap per position.',
    why: 'Classical games are decided by calculation at a few critical moments. This is slow, effortful practice on purpose.',
    tool: 'think',
  },
  {
    id: 'endgame',
    title: 'Endgames',
    minutes: 40,
    what: "One chapter of 100 Endgames You Must Know (de la Villa). Rook endings first. Set up the key positions and play them against yourself.",
    why: 'Long games reach endgames far more often than 10+0. These positions come up again and again and are learned once.',
  },
  {
    id: 'review',
    title: 'Game review',
    minutes: 30,
    what: 'Review your last long game: yourself first, then the engine. Write one rule.',
    why: 'Your own games show your real weaknesses. Self-analysis before the engine trains judgment, not just memory.',
    tool: 'review',
  },
  {
    id: 'games',
    title: 'Long games',
    minutes: 60,
    what: 'Play 30+20 or slower (3-4 games a week). Use the 5-step check every move and keep to the time plan.',
    why: 'Serious play at a slow time control is the only way to practise classical habits. Blitz trains the opposite.',
  },
  {
    id: 'openings',
    title: 'Openings',
    minutes: 20,
    what: 'Play through one master game in an opening you play. Learn the plans and pawn structures, not long move orders.',
    why: 'At this level, understanding the middlegames your openings lead to is worth more than more theory.',
  },
];

/** Which block fixes which kind of mistake. */
export const BLOCK_FOR_TAG: Record<Tag, BlockId> = {
  'tactic missed': 'tactics',
  calculation: 'calculation',
  endgame: 'endgame',
  'time trouble': 'games',
  opening: 'openings',
  positional: 'review',
};

/**
 * Today's blocks scaled to your daily hours. Your two biggest weaknesses each get +25% time,
 * taken evenly from the rest, so the plan follows your games instead of a fixed template.
 */
export function dailyPlan(hoursPerDay: number, weakTags: Tag[]): (Block & { focus: boolean })[] {
  const focus = new Set(weakTags.slice(0, 2).map((t) => BLOCK_FOR_TAG[t]));
  const raw = BLOCKS.map((b) => ({ ...b, focus: focus.has(b.id), minutes: b.minutes * (focus.has(b.id) ? 1.25 : 1) }));
  const total = raw.reduce((a, b) => a + b.minutes, 0);
  const scale = (hoursPerDay * 60) / total;
  return raw.map((b) => ({ ...b, minutes: Math.max(10, Math.round((b.minutes * scale) / 5) * 5) }));
}

export interface Book {
  title: string;
  author: string;
  use: string;
}

export const BOOKS: Book[] = [
  { title: '100 Endgames You Must Know', author: 'Jesús de la Villa', use: 'The endgame block. Rook endings first, then pawn and minor-piece endings.' },
  { title: 'The Woodpecker Method', author: 'Axel Smith & Hans Tikkanen', use: 'A fixed tactics set to repeat in cycles, faster each time.' },
  { title: 'Build Up Your Chess series', author: 'Artur Yusupov', use: 'Structured lessons with tests. Start with "Boost Your Chess" at your level.' },
  { title: 'Is Your Move Safe?', author: 'Dan Heisman', use: 'Drills the blunder check until it is automatic.' },
  { title: 'Think Like a Grandmaster', author: 'Alexander Kotov', use: 'Candidate moves and calculating each line once.' },
  { title: 'Training for the Tournament Player', author: 'Mark Dvoretsky & Artur Yusupov', use: 'How to analyse your own games and train like a tournament player.' },
];

export const SOURCES = [
  { label: 'Charness et al. (2005), The role of deliberate practice in chess expertise', url: 'https://repub.eur.nl/pub/14116' },
  { label: 'Burgoyne et al. (2019), reanalysis of the same data', url: 'https://englelab.gatech.edu/articles/2019/Burgoyne_et_al_2019_AJP.pdf' },
  { label: 'Dan Heisman, thought process principles', url: 'https://www.danheisman.com/thought-process-principles.html' },
  { label: 'Analyse your own games, Yusupov style', url: 'https://chess.com/blog/Chessmo/analyze-your-own-games' },
  { label: 'Candidate moves (Kotov)', url: 'https://en.wikipedia.org/wiki/Candidate_move' },
  { label: '100 Endgames You Must Know, position-by-position study on Lichess', url: 'https://lichess.org/study/by/O102004/alphabetical' },
];

/** Plain-language definitions shown wherever the terms appear. */
export const GLOSSARY: { term: string; text: string }[] = [
  { term: 'Eval', text: "Stockfish's score. +1.00 is roughly an extra pawn for White; negative numbers favour Black. M3 means mate in 3." },
  { term: 'Blunder (??)', text: 'A move that throws away at least 15% of your winning chances. Usually loses material or the game.' },
  { term: 'Mistake (?)', text: 'Loses 10-15% of your winning chances.' },
  { term: 'Inaccuracy (?!)', text: 'Loses 5-10%. Not the end of the world, but it adds up.' },
  { term: 'Centipawn loss', text: 'How much worse your move was than the best move, in hundredths of a pawn. Lower is better.' },
  { term: 'Critical moment', text: 'A position where the right move matters a lot: the eval swings depending on what you play.' },
];
