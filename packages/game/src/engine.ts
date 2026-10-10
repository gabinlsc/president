import type {
  GameAction,
  GameState,
  GameStateOf,
  LobbyState,
  TransitionResult,
} from '@president/shared';
import { ACTION_PHASES, assertTransition } from './machine';
import { pass, play } from './play';
import { completeDeal, exchange, nextRound, seat, start, unseat } from './round';
import type { Step } from './step';
import { RuleBreak } from './violations';
import { RULE_MESSAGES } from './violations';

export const createGame = (): LobbyState => ({
  phase: 'lobby',
  round: 0,
  isReversed: false,
  seats: [],
});

const as = <P extends GameState['phase']>(state: GameState, phase: P): GameStateOf<P> => {
  if (state.phase !== phase) throw new Error(`Expected phase ${phase}, got ${state.phase}`);
  return state as GameStateOf<P>;
};

function dispatch(state: GameState, action: GameAction): Step {
  switch (action.type) {
    case 'seat':
      return seat(as(state, 'lobby'), action.playerId, action.name);
    case 'unseat':
      return unseat(as(state, 'lobby'), action.playerId);
    case 'start':
      return start(as(state, 'lobby'), action.seed);
    case 'completeDeal':
      return completeDeal(as(state, 'dealing'));
    case 'exchange':
      return exchange(as(state, 'exchanging'), action.playerId, action.cards);
    case 'play':
      return play(as(state, 'playing'), action.playerId, action.cards);
    case 'pass':
      return pass(as(state, 'playing'), action.playerId);
    case 'nextRound':
      return nextRound(as(state, 'roundOver'), action.seed);
  }
}

/**
 * The game reducer: a pure function of the current state and one action.
 * It never mutates its input; a rejected action returns the violated rule.
 */
export function transition(state: GameState, action: GameAction): TransitionResult {
  if (ACTION_PHASES[action.type] !== state.phase)
    return { ok: false, error: { code: 'WRONG_PHASE', message: RULE_MESSAGES.WRONG_PHASE } };
  try {
    const step = dispatch(state, action);
    assertTransition(state.phase, step.state.phase);
    return { ok: true, state: step.state, events: step.events };
  } catch (error) {
    if (error instanceof RuleBreak) return { ok: false, error: error.violation };
    throw error;
  }
}
