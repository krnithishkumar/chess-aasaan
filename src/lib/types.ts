export const TAGS = ['opening', 'tactic missed', 'calculation', 'endgame', 'time trouble', 'positional'] as const;
export type Tag = (typeof TAGS)[number];

export type Severity = 'inaccuracy' | 'mistake' | 'blunder';
export type Phase = 'opening' | 'middlegame' | 'endgame';
export type Color = 'w' | 'b';

export interface RawGame {
  id: string;
  url: string;
  pgn: string;
  timeClass: string;
  timeControl: string;
  endTime: number;
  rated: boolean;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
  accuracies?: { white: number; black: number };
}

/** Engine evaluation, always from White's point of view. */
export interface Eval {
  cp?: number;
  mate?: number;
  /** Best move in UCI, absent for terminal positions. */
  best?: string;
  pv: string[];
  depth: number;
}

export interface MoveRecord {
  ply: number;
  moveNo: number;
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** Seconds left on the mover's clock after the move. */
  clockAfter?: number;
  /** Seconds spent on the move (increment accounted for). */
  timeSpent?: number;
  evalBefore: Eval;
  evalAfter: Eval;
  /** Win% for the mover before/after the move (0-100). */
  winBefore: number;
  winAfter: number;
  /** Win% points lost by this move. */
  loss: number;
  /** Centipawns lost, clamped to [0, 1000]. */
  cpLoss: number;
  severity?: Severity;
  phase: Phase;
  bestSan?: string;
  bestLineSan: string[];
  /** Opponent's best reply after the move actually played. */
  replySan?: string;
  replyLineSan: string[];
  autoTags: Tag[];
  /** User overrides; when set, replaces autoTags. */
  tags?: Tag[];
  reason?: string;
  note?: string;
}

export interface AnalyzedGame {
  id: string;
  url: string;
  userColor: Color;
  opponent: string;
  opponentRating: number;
  userRating: number;
  result: 'win' | 'loss' | 'draw';
  timeClass: string;
  timeControl: string;
  baseSeconds: number;
  increment: number;
  endTime: number;
  opening?: string;
  depth: number;
  analyzedAt: number;
  moves: MoveRecord[];
}

export interface QuizAttempt {
  at: number;
  plan: string;
  candidates: string[];
  hitBest: boolean;
  grade: 'got' | 'partial' | 'missed';
}

export interface QuizCard {
  id: string;
  gameId: string;
  ply: number;
  box: number;
  due: number;
  attempts: QuizAttempt[];
}

export interface Settings {
  username: string;
  depth: number;
  months: number;
  timeClasses: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  username: 'nithish_ravi',
  depth: 16,
  months: 3,
  timeClasses: ['rapid', 'daily'],
};

export function tagsOf(m: MoveRecord): Tag[] {
  return m.tags ?? m.autoTags;
}
