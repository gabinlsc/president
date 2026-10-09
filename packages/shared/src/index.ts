export type Suit = 'hearts' | 'spades' | 'diamonds' | 'clubs';
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}
export type Role = 'president' | 'vice-president' | 'neutral' | 'vice-trouduc' | 'trouduc';
export type Phase = 'waiting' | 'playing' | 'exchange' | 'finished';
export interface PublicPlayer {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  count: number;
  role: Role;
  finish: number | null;
}
export interface Table {
  cards: Card[];
  format: number;
  rank: Rank;
  owner: string;
  equalRequired: boolean;
  run: Card[];
}
export interface RoomView {
  code: string;
  mode: 'solo' | 'online';
  hostId: string;
  phase: Phase;
  players: PublicPlayer[];
  selfId: string;
  hand: Card[];
  table: Table | null;
  turn: string | null;
  direction: 1 | -1;
  round: number;
  ranking: string[];
  log: string[];
  exchangeCount: number;
  exchangeSubmitted: boolean;
  opening: boolean;
}
export type Reply<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export interface Session {
  token: string;
  playerId: string;
  code: string;
}
export interface ClientEvents {
  'room:create': (
    input: { name: string; mode: 'online' | 'solo'; bots?: number },
    ack: (r: Reply<Session>) => void,
  ) => void;
  'room:join': (input: { code: string; name: string }, ack: (r: Reply<Session>) => void) => void;
  'session:resume': (input: { token: string }, ack: (r: Reply<Session>) => void) => void;
  'room:start': (ack: (r: Reply) => void) => void;
  'room:leave': (ack: (r: Reply) => void) => void;
  'game:play': (input: { cards: string[] }, ack: (r: Reply) => void) => void;
  'game:pass': (ack: (r: Reply) => void) => void;
  'game:exchange': (input: { cards: string[] }, ack: (r: Reply) => void) => void;
  'game:next': (ack: (r: Reply) => void) => void;
}
export interface ServerEvents {
  'room:state': (state: RoomView) => void;
}
export const SUITS: Record<Suit, string> = { hearts: '♥', spades: '♠', diamonds: '♦', clubs: '♣' };
const labels: Partial<Record<Rank, string>> = { 11: 'V', 12: 'D', 13: 'R', 14: 'A', 15: '2' };
export const rankLabel = (rank: Rank): string => labels[rank] ?? String(rank);
export const roleLabel: Record<Role, string> = {
  president: 'Président',
  'vice-president': 'Vice-président',
  neutral: 'Citoyen',
  'vice-trouduc': 'Vice-trouduc',
  trouduc: 'Trou du cul',
};
