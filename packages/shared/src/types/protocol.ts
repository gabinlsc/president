import type { CardId } from './cards';
import type { RoomMode, RoomSnapshot } from './view';
import type { PlayerId } from './game';

export type Reply<T = null> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string };
export type Ack<T = null> = (reply: Reply<T>) => void;

export interface Session {
  readonly token: string;
  readonly playerId: PlayerId;
  readonly code: string;
}

export interface CreateRoomInput {
  readonly name: string;
  readonly mode: RoomMode;
  readonly bots?: number;
}
export interface JoinRoomInput {
  readonly code: string;
  readonly name: string;
}
export interface ResumeInput {
  readonly token: string;
}
export interface CardsInput {
  readonly cards: readonly CardId[];
}

export interface ClientToServerEvents {
  'room:create': (input: CreateRoomInput, ack: Ack<Session>) => void;
  'room:join': (input: JoinRoomInput, ack: Ack<Session>) => void;
  'session:resume': (input: ResumeInput, ack: Ack<Session>) => void;
  'room:start': (ack: Ack) => void;
  'room:leave': (ack: Ack) => void;
  'game:play': (input: CardsInput, ack: Ack) => void;
  'game:pass': (ack: Ack) => void;
  'game:exchange': (input: CardsInput, ack: Ack) => void;
  'game:next': (ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
}
