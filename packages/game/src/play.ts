import {
  QUEEN_OF_SPADES,
  RANK_TWO,
  type Card,
  type CardId,
  type GameEvent,
  type PlayerId,
  type PlayingState,
  type RoundOverState,
  type Trick,
  type TrickClearReason,
  type TrickFormat,
} from '@president/shared';
import { finishRound } from './round';
import { isActive, leaderAfter, nextSeat, seatOf } from './seats';
import type { Step } from './step';
import { ensure } from './violations';

const SQUARE = 4;

export interface ValidPlay {
  readonly cards: readonly Card[];
  /** Completes a square on the table: playable out of turn, clears the trick. */
  readonly isCut: boolean;
}

/** A square can be completed on any trick that did not start in triples. */
export const completesSquare = (trick: Trick | null, cards: readonly Card[]): boolean =>
  trick !== null &&
  trick.format !== 3 &&
  cards.every((c) => c.rank === trick.rank) &&
  trick.run + cards.length === SQUARE;

/** Checks a play against every rule without changing anything. Throws `RuleBreak`. */
export function validatePlay(
  state: PlayingState,
  playerId: PlayerId,
  ids: readonly CardId[],
): ValidPlay {
  const seat = seatOf(state, playerId);
  ensure(
    ids.length >= 1 && ids.length <= SQUARE && new Set(ids).size === ids.length,
    'INVALID_SELECTION',
  );
  const cards = ids.map((id) => seat.hand.find((c) => c.id === id));
  ensure(
    cards.every((c) => c !== undefined),
    'CARDS_NOT_IN_HAND',
  );
  const rank = cards[0]!.rank;
  ensure(
    cards.every((c) => c.rank === rank),
    'MIXED_RANKS',
  );
  const { trick } = state;
  if (completesSquare(trick, cards)) return { cards, isCut: true };

  ensure(state.turn === playerId, 'NOT_YOUR_TURN');
  ensure(!state.passed.includes(playerId), 'ALREADY_PASSED');
  ensure(cards.length < SQUARE, 'SQUARE_MUST_CUT');
  if (state.mustOpenWith) ensure(ids.includes(state.mustOpenWith), 'MUST_OPEN_WITH');
  if (trick) {
    ensure(cards.length === trick.format, 'FORMAT_MISMATCH');
    if (trick.sameRankRequired) ensure(rank === trick.rank, 'SAME_RANK_REQUIRED');
    else ensure(rank >= trick.rank, 'RANK_TOO_LOW');
  }
  return { cards, isCut: false };
}

function clearTrick(
  state: PlayingState,
  plays: Trick['plays'],
  reason: TrickClearReason,
  leaderId: PlayerId | null,
  events: GameEvent[],
): Step<PlayingState> {
  if (leaderId === null) throw new Error('A trick cleared without any player left to lead');
  return {
    state: { ...state, trick: null, passed: [], turn: leaderId },
    events: [...events, { type: 'trickCleared', reason, plays, leaderId }],
  };
}

export function play(
  state: PlayingState,
  playerId: PlayerId,
  ids: readonly CardId[],
): Step<PlayingState | RoundOverState> {
  const { cards, isCut } = validatePlay(state, playerId, ids);
  const rank = cards[0]!.rank;
  const previous = state.trick;
  const events: GameEvent[] = [
    { type: 'played', playerId, cards, outOfTurn: state.turn !== playerId },
  ];

  const played = new Set(ids);
  const seats = state.seats.map((s) =>
    s.id === playerId ? { ...s, hand: s.hand.filter((c) => !played.has(c.id)) } : s,
  );
  let isReversed = state.isReversed;
  if (ids.includes(QUEEN_OF_SPADES)) {
    isReversed = !isReversed;
    events.push({ type: 'reversed', isReversed });
  }

  const sameRank = previous !== null && previous.rank === rank;
  const trick: Trick = {
    format: previous?.format ?? (cards.length as TrickFormat),
    rank,
    ownerId: playerId,
    sameRankRequired: sameRank,
    run: sameRank ? previous.run + cards.length : cards.length,
    plays: [...(previous?.plays ?? []), { playerId, cards }],
  };

  let { finished, penalized } = state;
  let becamePresident = false;
  if (seatOf({ seats, isReversed }, playerId).hand.length === 0) {
    const isPenalized = rank === RANK_TWO;
    becamePresident = !isPenalized && finished.length === 0;
    if (isPenalized) penalized = [...penalized, playerId];
    else finished = [...finished, playerId];
    events.push({ type: 'playerFinished', playerId, penalized: isPenalized });
  }

  const next: PlayingState = {
    ...state,
    seats,
    isReversed,
    trick,
    finished,
    penalized,
    mustOpenWith: null,
  };
  if (seats.filter(isActive).length <= 1) return finishRound(next, events);

  const reason: TrickClearReason | null =
    rank === RANK_TWO
      ? 'two'
      : isCut || (trick.format !== 3 && trick.run === 4)
        ? 'square'
        : becamePresident
          ? 'presidentOut'
          : null;
  if (reason) return clearTrick(next, trick.plays, reason, leaderAfter(next, playerId), events);

  const turn = nextSeat(
    next,
    playerId,
    (s) => isActive(s) && !next.passed.includes(s.id) && s.id !== playerId,
  );
  if (turn === null)
    return clearTrick(next, trick.plays, 'allPassed', leaderAfter(next, playerId), events);
  return { state: { ...next, turn }, events };
}

export function pass(state: PlayingState, playerId: PlayerId): Step<PlayingState> {
  seatOf(state, playerId);
  ensure(state.turn === playerId, 'NOT_YOUR_TURN');
  const { trick } = state;
  ensure(trick, 'CANNOT_PASS_ON_LEAD');
  const passed = [...state.passed, playerId];
  // A pass lifts the "même carte" constraint for the following player.
  const next: PlayingState = { ...state, passed, trick: { ...trick, sameRankRequired: false } };
  const events: GameEvent[] = [{ type: 'passed', playerId }];
  const turn = nextSeat(next, playerId, (s) => isActive(s) && !passed.includes(s.id));
  if (turn === null || turn === trick.ownerId)
    return clearTrick(next, trick.plays, 'allPassed', leaderAfter(next, trick.ownerId), events);
  return { state: { ...next, turn }, events };
}
