import type {
  Card,
  CardId,
  ExchangeView,
  GameState,
  GameView,
  PlayerId,
  PublicSeat,
  SeatStatus,
} from '@president/shared';
import { validatePlay } from './play';

function statusOf(state: GameState, id: PlayerId, cardCount: number): SeatStatus {
  switch (state.phase) {
    case 'lobby':
      return 'waiting';
    case 'roundOver':
      return 'finished';
    case 'playing':
      return cardCount === 0 ? 'finished' : state.passed.includes(id) ? 'passed' : 'playing';
    case 'dealing':
    case 'exchanging':
      return 'playing';
  }
}

function placeOf(state: GameState, id: PlayerId): number | null {
  if (state.phase === 'roundOver') return state.ranking.indexOf(id) + 1;
  if (state.phase === 'playing' && state.finished.includes(id))
    return state.finished.indexOf(id) + 1;
  return null;
}

/** Subsets of `cards`, smallest first, each keeping the hand order. */
function subsets(cards: readonly Card[]): Card[][] {
  const result: Card[][] = [];
  for (let mask = 1; mask < 1 << cards.length; mask++)
    result.push(cards.filter((_, i) => mask & (1 << i)));
  return result.sort((a, b) => a.length - b.length);
}

/** Every play `playerId` may make right now, including out-of-turn squares. */
export function legalPlays(state: GameState, playerId: PlayerId): CardId[][] {
  if (state.phase !== 'playing') return [];
  const seat = state.seats.find((s) => s.id === playerId);
  if (!seat) return [];
  const groups = new Map<number, Card[]>();
  for (const card of seat.hand) groups.set(card.rank, [...(groups.get(card.rank) ?? []), card]);
  const plays: CardId[][] = [];
  for (const group of [...groups.entries()].sort(([a], [b]) => a - b).map(([, cards]) => cards))
    for (const candidate of subsets(group)) {
      const ids = candidate.map((c) => c.id);
      try {
        validatePlay(state, playerId, ids);
        plays.push(ids);
      } catch {
        // Not a legal play: skip it.
      }
    }
  return plays;
}

function exchangeOf(state: GameState, viewerId: PlayerId): ExchangeView | null {
  if (state.phase !== 'exchanging') return null;
  const transfer = state.transfers.find((t) => t.fromId === viewerId);
  if (!transfer) return null;
  return {
    partnerId: transfer.toId,
    give: transfer.count,
    forced: transfer.forced,
    submitted: transfer.cards !== null,
    reserved: transfer.forced ? (transfer.cards ?? []) : [],
  };
}

/** Projects the authoritative state for one viewer: other hands are reduced to card counts. */
export function toGameView(state: GameState, viewerId: PlayerId): GameView {
  const seats: PublicSeat[] = state.seats.map((s) => ({
    id: s.id,
    name: s.name,
    cardCount: s.hand.length,
    role: s.role,
    status: statusOf(state, s.id, s.hand.length),
    place: placeOf(state, s.id),
    penalized:
      (state.phase === 'playing' || state.phase === 'roundOver') && state.penalized.includes(s.id),
  }));
  const playing = state.phase === 'playing' ? state : null;
  return {
    phase: state.phase,
    round: state.round,
    isReversed: state.isReversed,
    seats,
    turn: playing?.turn ?? null,
    trick: playing?.trick ?? null,
    mustOpenWith: playing?.mustOpenWith ?? null,
    hand: state.seats.find((s) => s.id === viewerId)?.hand ?? [],
    legalPlays: legalPlays(state, viewerId),
    canPass: playing !== null && playing.turn === viewerId && playing.trick !== null,
    exchange: exchangeOf(state, viewerId),
    pendingExchanges:
      state.phase === 'exchanging' ? state.transfers.filter((t) => t.cards === null).length : 0,
    ranking: state.phase === 'roundOver' ? state.ranking : [],
  };
}
