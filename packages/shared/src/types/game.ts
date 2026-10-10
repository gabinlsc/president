import type { Card, CardId, Rank } from './cards';

export type PlayerId = string;

export const ROLES = ['president', 'vice-president', 'neutral', 'vice-trouduc', 'trouduc'] as const;
export type Role = (typeof ROLES)[number];

/** Ordered lifecycle of a table. Allowed transitions live in `@president/game` (machine.ts). */
export const GAME_PHASES = ['lobby', 'dealing', 'exchanging', 'playing', 'roundOver'] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/** A trick is opened with singles, pairs or triples; squares only ever cut. */
export type TrickFormat = 1 | 2 | 3;

export interface Play {
  readonly playerId: PlayerId;
  readonly cards: readonly Card[];
}

export interface Trick {
  readonly format: TrickFormat;
  /** Rank of the last play: the value to match or beat. */
  readonly rank: Rank;
  readonly ownerId: PlayerId;
  /** "Même carte" constraint: the next player must match `rank` or pass. */
  readonly sameRankRequired: boolean;
  /** Cards of `rank` laid consecutively on top of the trick, used to detect a square. */
  readonly run: number;
  readonly plays: readonly Play[];
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly hand: readonly Card[];
  /** Role earned during the previous round; `neutral` during the first round. */
  readonly role: Role;
}

export interface ExchangeTransfer {
  readonly fromId: PlayerId;
  readonly toId: PlayerId;
  readonly count: 1 | 2;
  /** Losers must hand over their best cards: those are chosen by the engine. */
  readonly forced: boolean;
  readonly cards: readonly CardId[] | null;
}

interface GameStateBase {
  readonly round: number;
  readonly seats: readonly PlayerState[];
  readonly isReversed: boolean;
}

export interface LobbyState extends GameStateBase {
  readonly phase: 'lobby';
}

export interface DealingState extends GameStateBase {
  readonly phase: 'dealing';
  readonly transfers: readonly ExchangeTransfer[];
}

export interface ExchangingState extends GameStateBase {
  readonly phase: 'exchanging';
  readonly transfers: readonly ExchangeTransfer[];
}

export interface PlayingState extends GameStateBase {
  readonly phase: 'playing';
  readonly turn: PlayerId;
  readonly trick: Trick | null;
  /** Players who passed on the current trick; they may only come back with a square. */
  readonly passed: readonly PlayerId[];
  /** Finish order of players who did not end on a 2. */
  readonly finished: readonly PlayerId[];
  /** Players who ended on a 2, in finishing order. */
  readonly penalized: readonly PlayerId[];
  /** Card the opening play must contain (Queen of hearts on the first round). */
  readonly mustOpenWith: CardId | null;
}

export interface RoundOverState extends GameStateBase {
  readonly phase: 'roundOver';
  /** Final standings, best first. Roles already reflect it. */
  readonly ranking: readonly PlayerId[];
}

export type GameState = LobbyState | DealingState | ExchangingState | PlayingState | RoundOverState;
export type GameStateOf<P extends GamePhase> = Extract<GameState, { phase: P }>;

export type GameAction =
  | { readonly type: 'seat'; readonly playerId: PlayerId; readonly name: string }
  | { readonly type: 'unseat'; readonly playerId: PlayerId }
  | { readonly type: 'start'; readonly seed: number }
  | { readonly type: 'completeDeal' }
  | { readonly type: 'exchange'; readonly playerId: PlayerId; readonly cards: readonly CardId[] }
  | { readonly type: 'play'; readonly playerId: PlayerId; readonly cards: readonly CardId[] }
  | { readonly type: 'pass'; readonly playerId: PlayerId }
  | { readonly type: 'nextRound'; readonly seed: number };
export type GameActionType = GameAction['type'];

export type TrickClearReason = 'two' | 'square' | 'allPassed' | 'presidentOut';

/** Public facts produced by a transition; they drive client animations and the log. */
export type GameEvent =
  | { readonly type: 'dealt'; readonly round: number }
  | { readonly type: 'exchanged' }
  | {
      readonly type: 'played';
      readonly playerId: PlayerId;
      readonly cards: readonly Card[];
      readonly outOfTurn: boolean;
    }
  | { readonly type: 'passed'; readonly playerId: PlayerId }
  | { readonly type: 'reversed'; readonly isReversed: boolean }
  | {
      readonly type: 'trickCleared';
      readonly reason: TrickClearReason;
      readonly plays: readonly Play[];
      readonly leaderId: PlayerId | null;
    }
  | {
      readonly type: 'playerFinished';
      readonly playerId: PlayerId;
      readonly penalized: boolean;
    }
  | { readonly type: 'roundOver'; readonly ranking: readonly PlayerId[] };

export const RULE_VIOLATIONS = [
  'WRONG_PHASE',
  'UNKNOWN_PLAYER',
  'DUPLICATE_PLAYER',
  'TABLE_FULL',
  'NOT_ENOUGH_PLAYERS',
  'INVALID_SELECTION',
  'CARDS_NOT_IN_HAND',
  'MIXED_RANKS',
  'NOT_YOUR_TURN',
  'ALREADY_PASSED',
  'MUST_OPEN_WITH',
  'FORMAT_MISMATCH',
  'RANK_TOO_LOW',
  'SAME_RANK_REQUIRED',
  'SQUARE_MUST_CUT',
  'CANNOT_PASS_ON_LEAD',
  'NO_EXCHANGE_EXPECTED',
  'EXCHANGE_ALREADY_SUBMITTED',
  'WRONG_CARD_COUNT',
] as const;
export type RuleViolationCode = (typeof RULE_VIOLATIONS)[number];

export interface RuleViolation {
  readonly code: RuleViolationCode;
  readonly message: string;
}

export type TransitionResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: RuleViolation };
