import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  QUEEN_OF_HEARTS,
  type CardId,
  type DealingState,
  type ExchangeTransfer,
  type ExchangingState,
  type GameEvent,
  type LobbyState,
  type PlayerId,
  type PlayerState,
  type PlayingState,
  type Role,
  type RoundOverState,
} from '@president/shared';
import { bestCards, makeDeck, shuffle, sortCards } from './deck';
import { seatOf } from './seats';
import { ensure } from './violations';
import type { Step } from './step';

export function seat(state: LobbyState, playerId: PlayerId, name: string): Step<LobbyState> {
  ensure(!state.seats.some((s) => s.id === playerId), 'DUPLICATE_PLAYER');
  ensure(state.seats.length < MAX_PLAYERS, 'TABLE_FULL');
  return {
    state: { ...state, seats: [...state.seats, { id: playerId, name, hand: [], role: 'neutral' }] },
    events: [],
  };
}

export function unseat(state: LobbyState, playerId: PlayerId): Step<LobbyState> {
  seatOf(state, playerId);
  return { state: { ...state, seats: state.seats.filter((s) => s.id !== playerId) }, events: [] };
}

function deal(seats: readonly PlayerState[], seed: number): PlayerState[] {
  const hands: PlayerState['hand'][] = seats.map(() => []);
  shuffle(makeDeck(), seed).forEach((card, i) => {
    const index = i % seats.length;
    hands[index] = [...hands[index]!, card];
  });
  return seats.map((s, i) => ({ ...s, hand: sortCards(hands[i]!) }));
}

/** Winner role, loser role and how many cards change hands between them. */
const EXCHANGE_PAIRS: readonly (readonly [Role, Role, 1 | 2])[] = [
  ['president', 'trouduc', 2],
  ['vice-president', 'vice-trouduc', 1],
];

function buildTransfers(seats: readonly PlayerState[]): ExchangeTransfer[] {
  return EXCHANGE_PAIRS.flatMap(([winnerRole, loserRole, count]) => {
    const winner = seats.find((s) => s.role === winnerRole);
    const loser = seats.find((s) => s.role === loserRole);
    if (!winner || !loser) return [];
    return [
      {
        fromId: loser.id,
        toId: winner.id,
        count,
        forced: true,
        cards: bestCards(loser.hand, count),
      },
      { fromId: winner.id, toId: loser.id, count, forced: false, cards: null },
    ];
  });
}

export function start(state: LobbyState, seed: number): Step<DealingState> {
  ensure(state.seats.length >= MIN_PLAYERS, 'NOT_ENOUGH_PLAYERS');
  const seats = deal(
    state.seats.map((s) => ({ ...s, role: 'neutral' as const })),
    seed,
  );
  return {
    state: { phase: 'dealing', round: 1, isReversed: false, seats, transfers: [] },
    events: [{ type: 'dealt', round: 1 }],
  };
}

export function nextRound(state: RoundOverState, seed: number): Step<DealingState> {
  const seats = deal(state.seats, seed);
  const round = state.round + 1;
  return {
    state: { phase: 'dealing', round, isReversed: false, seats, transfers: buildTransfers(seats) },
    events: [{ type: 'dealt', round }],
  };
}

/** First round: the Queen of hearts holder opens with it. Later rounds: the Trou du cul opens. */
function beginPlay(base: { round: number; seats: readonly PlayerState[] }): PlayingState {
  const firstRound = base.round === 1;
  const opener = firstRound
    ? base.seats.find((s) => s.hand.some((c) => c.id === QUEEN_OF_HEARTS))
    : (base.seats.find((s) => s.role === 'trouduc') ?? base.seats[0]);
  if (!opener) throw new Error('No opener: the deck was not fully dealt');
  return {
    phase: 'playing',
    round: base.round,
    isReversed: false,
    seats: base.seats,
    turn: opener.id,
    trick: null,
    passed: [],
    finished: [],
    penalized: [],
  };
}

export function completeDeal(state: DealingState): Step<ExchangingState | PlayingState> {
  if (state.transfers.some((t) => t.cards === null))
    return { state: { ...state, phase: 'exchanging' }, events: [] };
  return { state: beginPlay(state), events: [] };
}

export function exchange(
  state: ExchangingState,
  playerId: PlayerId,
  ids: readonly CardId[],
): Step<ExchangingState | PlayingState> {
  const giver = seatOf(state, playerId);
  const transfer = state.transfers.find((t) => t.fromId === playerId && !t.forced);
  ensure(transfer, 'NO_EXCHANGE_EXPECTED');
  ensure(transfer.cards === null, 'EXCHANGE_ALREADY_SUBMITTED');
  ensure(new Set(ids).size === ids.length, 'INVALID_SELECTION');
  ensure(ids.length === transfer.count, 'WRONG_CARD_COUNT');
  ensure(
    ids.every((id) => giver.hand.some((c) => c.id === id)),
    'CARDS_NOT_IN_HAND',
  );
  const transfers = state.transfers.map((t) => (t === transfer ? { ...t, cards: [...ids] } : t));
  if (transfers.some((t) => t.cards === null))
    return { state: { ...state, transfers }, events: [] };

  // Every gift was chosen from the dealt hands: apply them all at once.
  const seats = state.seats.map((s) => {
    const given = new Set(transfers.filter((t) => t.fromId === s.id).flatMap((t) => t.cards ?? []));
    const received = transfers
      .filter((t) => t.toId === s.id)
      .flatMap((t) =>
        (t.cards ?? []).map((id) => seatOf(state, t.fromId).hand.find((c) => c.id === id)!),
      );
    return { ...s, hand: sortCards([...s.hand.filter((c) => !given.has(c.id)), ...received]) };
  });
  return { state: beginPlay({ round: state.round, seats }), events: [{ type: 'exchanged' }] };
}

function roleFor(place: number, count: number): Role {
  if (place === 0) return 'president';
  if (place === count - 1) return 'trouduc';
  if (count >= 4 && place === 1) return 'vice-president';
  if (count >= 4 && place === count - 2) return 'vice-trouduc';
  return 'neutral';
}

/** Standings: finishers in order, then whoever still holds cards, then the 2-penalized. */
export function finishRound(state: PlayingState, events: GameEvent[]): Step<RoundOverState> {
  const remaining = state.seats.filter((s) => s.hand.length > 0).map((s) => s.id);
  const ranking = [...state.finished, ...remaining, ...state.penalized];
  const seats = state.seats.map((s) => ({
    ...s,
    role: roleFor(ranking.indexOf(s.id), ranking.length),
  }));
  return {
    state: {
      phase: 'roundOver',
      round: state.round,
      isReversed: state.isReversed,
      seats,
      ranking,
      penalized: state.penalized,
    },
    events: [...events, { type: 'roundOver', ranking }],
  };
}
