import { expect } from 'vitest';
import { transition } from '@president/game';
import type {
  Card,
  GameAction,
  GameEvent,
  GameState,
  PlayingState,
  Rank,
  RuleViolationCode,
  Suit,
} from '@president/shared';

export const card = (rank: Rank, suit: Suit = 'clubs'): Card => ({
  id: `${rank}-${suit}`,
  rank,
  suit,
});

/** Four suits in a stable order, so tests can ask for "a second 6" without colliding ids. */
export const SUIT_ORDER: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Builds a playing state where seat `i` is `p${i}` and holds `hands[i]`. */
export function playing(hands: Card[][], overrides: Partial<PlayingState> = {}): PlayingState {
  return {
    phase: 'playing',
    round: 1,
    isReversed: false,
    seats: hands.map((hand, i) => ({ id: `p${i}`, name: `J${i}`, hand, role: 'neutral' })),
    turn: 'p0',
    trick: null,
    passed: [],
    finished: [],
    penalized: [],
    mustOpenWith: null,
    ...overrides,
  };
}

export interface Applied<S extends GameState = GameState> {
  state: S;
  events: readonly GameEvent[];
}

/** Applies an action that must succeed, and proves the input state was never mutated. */
export function apply(state: GameState, action: GameAction): Applied {
  const frozen = deepFreeze(state);
  const result = transition(frozen, action);
  if (!result.ok)
    throw new Error(`${action.type} rejected: ${result.error.code} ${result.error.message}`);
  return { state: result.state, events: result.events };
}

/** Applies a sequence of actions from `state`, returning the final state and the last events. */
export function run(state: GameState, actions: GameAction[]): Applied {
  let current: Applied = { state, events: [] };
  for (const action of actions) current = apply(current.state, action);
  return current;
}

export function reject(state: GameState, action: GameAction, code: RuleViolationCode): void {
  const result = transition(deepFreeze(state), action);
  expect(result.ok, `${action.type} should be rejected with ${code}`).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
    expect(result.error.message.length).toBeGreaterThan(0);
  }
}

export function asPlaying(state: GameState): PlayingState {
  expect(state.phase).toBe('playing');
  return state as PlayingState;
}

export const play = (playerId: string, ...cards: Card[]): GameAction => ({
  type: 'play',
  playerId,
  cards: cards.map((c) => c.id),
});
export const pass = (playerId: string): GameAction => ({ type: 'pass', playerId });

export const handOf = (state: GameState, id: string) =>
  state.seats.find((s) => s.id === id)!.hand.map((c) => c.id);
export const allCardIds = (state: GameState) => state.seats.flatMap((s) => s.hand.map((c) => c.id));
