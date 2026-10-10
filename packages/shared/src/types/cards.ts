export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

/** Card strength, from 3 (weakest) to 2 (strongest, encoded as 15). */
export const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export type Rank = (typeof RANKS)[number];

export type CardId = `${Rank}-${Suit}`;

export interface Card {
  readonly id: CardId;
  readonly rank: Rank;
  readonly suit: Suit;
}

export const RANK_TWO = 15 satisfies Rank;
export const QUEEN_OF_HEARTS = '12-hearts' satisfies CardId;
export const QUEEN_OF_SPADES = '12-spades' satisfies CardId;
export const DECK_SIZE = SUITS.length * RANKS.length;
