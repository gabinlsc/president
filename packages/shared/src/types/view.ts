import type { Card, CardId, Rank } from './cards';
import type { GameEvent, GamePhase, PlayerId, Play, Role, TrickFormat } from './game';

export type SeatStatus = 'waiting' | 'playing' | 'passed' | 'finished';

/** What everybody may know about a seat: never its cards. */
export interface PublicSeat {
  readonly id: PlayerId;
  readonly name: string;
  readonly cardCount: number;
  readonly role: Role;
  readonly status: SeatStatus;
  /** 1-based finishing place in the current round (or final rank once it is over). */
  readonly place: number | null;
  readonly penalized: boolean;
}

export interface TrickView {
  readonly format: TrickFormat;
  readonly rank: Rank;
  readonly ownerId: PlayerId;
  readonly sameRankRequired: boolean;
  readonly run: number;
  readonly plays: readonly Play[];
}

export interface ExchangeView {
  readonly partnerId: PlayerId;
  readonly give: number;
  readonly forced: boolean;
  readonly submitted: boolean;
  /** Cards the engine already reserved for a forced gift. */
  readonly reserved: readonly CardId[];
}

/** Per-viewer projection of the authoritative state. */
export interface GameView {
  readonly phase: GamePhase;
  readonly round: number;
  readonly isReversed: boolean;
  readonly seats: readonly PublicSeat[];
  readonly turn: PlayerId | null;
  readonly trick: TrickView | null;
  readonly hand: readonly Card[];
  /** Every play the viewer may legally make right now, including out-of-turn squares. */
  readonly legalPlays: readonly (readonly CardId[])[];
  readonly canPass: boolean;
  /** The subset of `legalPlays` that completes a square and clears the table. */
  readonly squarePlays: readonly (readonly CardId[])[];
  readonly exchange: ExchangeView | null;
  readonly pendingExchanges: number;
  readonly ranking: readonly PlayerId[];
}

export type RoomMode = 'online' | 'solo';

export interface MemberView {
  readonly id: PlayerId;
  readonly name: string;
  readonly isBot: boolean;
  readonly connected: boolean;
}

export interface RoomSnapshot {
  readonly code: string;
  readonly mode: RoomMode;
  readonly hostId: PlayerId;
  readonly selfId: PlayerId;
  readonly members: readonly MemberView[];
  /** Monotonic counter; lets the client drop out-of-order snapshots. */
  readonly version: number;
  readonly game: GameView;
  /** Events produced by the transition that led to this snapshot. */
  readonly events: readonly GameEvent[];
}
