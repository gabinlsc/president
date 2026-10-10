import type { GameEvent, GameState, PlayerId, RoomMode } from '@president/shared';

export interface Member {
  readonly id: PlayerId;
  readonly name: string;
  isBot: boolean;
  connected: boolean;
  socketId: string | null;
  /** Opaque reconnection secret; `null` once revoked (left the room or bot). */
  token: string | null;
}

export interface Room {
  readonly code: string;
  readonly mode: RoomMode;
  hostId: PlayerId;
  /** Insertion order is seat order. */
  readonly members: Map<PlayerId, Member>;
  game: GameState;
  /** Incremented on every published change. */
  version: number;
  /** Events of the last transition, replayed to clients for animations. */
  lastEvents: readonly GameEvent[];
  touchedAt: number;
}

/** A member is played automatically when it is a bot or its human is disconnected. */
export const isAutomated = (member: Member): boolean => member.isBot || !member.connected;

export const hasConnectedHuman = (room: Room): boolean =>
  [...room.members.values()].some((m) => !m.isBot && m.connected);
