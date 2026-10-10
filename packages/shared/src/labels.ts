import type { Rank, Suit } from './types/cards';
import type { Role } from './types/game';

export const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = {
  hearts: '♥',
  spades: '♠',
  diamonds: '♦',
  clubs: '♣',
};
export const SUIT_NAMES: Readonly<Record<Suit, string>> = {
  hearts: 'cœur',
  spades: 'pique',
  diamonds: 'carreau',
  clubs: 'trèfle',
};
const FACE_LABELS: Readonly<Partial<Record<Rank, string>>> = {
  11: 'V',
  12: 'D',
  13: 'R',
  14: 'A',
  15: '2',
};
export const rankLabel = (rank: Rank): string => FACE_LABELS[rank] ?? String(rank);

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  president: 'Président',
  'vice-president': 'Vice-président',
  neutral: 'Citoyen',
  'vice-trouduc': 'Vice-trouduc',
  trouduc: 'Trou du cul',
};
