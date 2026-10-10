import {
  RANK_TWO,
  type CardId,
  type GameAction,
  type GameState,
  type PlayerId,
  type PlayingState,
} from '@president/shared';
import { lowestCards } from './deck';
import { completesSquare } from './play';
import { legalPlays } from './view';

const ACE = 14;

/** Lower is better: shed small cards, keep groups whole, save 2s and squares. */
function score(state: PlayingState, playerId: PlayerId, ids: readonly CardId[]): number {
  const hand = state.seats.find((s) => s.id === playerId)!.hand;
  const cards = hand.filter((c) => ids.includes(c.id));
  const rank = cards[0]!.rank;
  if (cards.length === hand.length) return rank === RANK_TWO ? 1000 : -1000;
  // Ending on a 2 is punished: once 2s are as many as the other cards, spend them now.
  const twos = hand.filter((c) => c.rank === RANK_TWO).length;
  if (rank === RANK_TWO && hand.length - twos <= twos) return -500 - cards.length;
  const groupSize = hand.filter((c) => c.rank === rank).length;
  return (
    rank * 3 -
    cards.length * 8 +
    (groupSize > cards.length ? 12 : 0) +
    (rank === RANK_TWO ? 20 : 0) -
    (completesSquare(state.trick, cards) ? 18 : 0)
  );
}

function choosePlay(state: PlayingState, playerId: PlayerId): GameAction | null {
  const moves = legalPlays(state, playerId);
  // Out of turn, the only legal moves are squares: always take the lead back.
  if (state.turn !== playerId) {
    const cut = moves[0];
    return cut ? { type: 'play', playerId, cards: cut } : null;
  }
  if (moves.length === 0) return { type: 'pass', playerId };
  const best = [...moves].sort((a, b) => score(state, playerId, a) - score(state, playerId, b))[0]!;
  const hand = state.seats.find((s) => s.id === playerId)!.hand;
  const bestRank = hand.find((c) => c.id === best[0])!.rank;
  const opponentsComfortable = state.seats
    .filter((s) => s.id !== playerId && s.hand.length > 0)
    .every((s) => s.hand.length > 3);
  // Keep Aces and 2s for later instead of spending them on an ordinary trick.
  if (
    state.trick &&
    !state.trick.sameRankRequired &&
    score(state, playerId, best) > -500 &&
    bestRank >= ACE &&
    best.length < hand.length &&
    opponentsComfortable
  )
    return { type: 'pass', playerId };
  if (score(state, playerId, best) >= 1000 && state.trick) return { type: 'pass', playerId };
  return { type: 'play', playerId, cards: best };
}

/** The action a bot takes for `playerId`, or `null` when nothing is expected from it. */
export function chooseBotAction(state: GameState, playerId: PlayerId): GameAction | null {
  if (state.phase === 'exchanging') {
    const transfer = state.transfers.find(
      (t) => t.fromId === playerId && !t.forced && t.cards === null,
    );
    if (!transfer) return null;
    const hand = state.seats.find((s) => s.id === playerId)?.hand ?? [];
    return { type: 'exchange', playerId, cards: lowestCards(hand, transfer.count) };
  }
  if (state.phase === 'playing') return choosePlay(state, playerId);
  return null;
}
