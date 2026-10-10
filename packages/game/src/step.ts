import type { GameEvent, GameState } from '@president/shared';

/** Successful outcome of a phase handler. */
export interface Step<S extends GameState = GameState> {
  readonly state: S;
  readonly events: readonly GameEvent[];
}
