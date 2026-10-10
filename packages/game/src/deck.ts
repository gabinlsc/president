import { RANKS, SUITS, type Card, type CardId } from '@president/shared';
import { createRandom } from './random';

const SUIT_INDEX = Object.fromEntries(SUITS.map((suit, i) => [suit, i])) as Record<
  Card['suit'],
  number
>;

export const compareCards = (a: Card, b: Card): number =>
  a.rank - b.rank || SUIT_INDEX[a.suit] - SUIT_INDEX[b.suit];

export const sortCards = (cards: readonly Card[]): Card[] => [...cards].sort(compareCards);

export function makeDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank): Card => ({ id: `${rank}-${suit}`, rank, suit })),
  );
}

/** Fisher–Yates driven by a seeded PRNG: same seed, same deal. */
export function shuffle(deck: readonly Card[], seed: number): Card[] {
  const random = createRandom(seed);
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** The strongest `count` cards of a hand (a 2 beats an Ace). */
export const bestCards = (hand: readonly Card[], count: number): CardId[] =>
  sortCards(hand)
    .slice(-count)
    .reverse()
    .map((c) => c.id);

export const lowestCards = (hand: readonly Card[], count: number): CardId[] =>
  sortCards(hand)
    .slice(0, count)
    .map((c) => c.id);
