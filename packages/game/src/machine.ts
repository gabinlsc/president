import type { GameActionType, GamePhase } from '@president/shared';

/** The only phase changes the engine may perform. */
export const PHASE_TRANSITIONS: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  lobby: ['dealing'],
  dealing: ['exchanging', 'playing'],
  exchanging: ['playing'],
  playing: ['roundOver'],
  roundOver: ['dealing'],
};

/** The single phase in which each action is accepted. */
export const ACTION_PHASES: Readonly<Record<GameActionType, GamePhase>> = {
  seat: 'lobby',
  unseat: 'lobby',
  start: 'lobby',
  completeDeal: 'dealing',
  exchange: 'exchanging',
  play: 'playing',
  pass: 'playing',
  nextRound: 'roundOver',
};

export const canTransition = (from: GamePhase, to: GamePhase): boolean =>
  PHASE_TRANSITIONS[from].includes(to);

export function assertTransition(from: GamePhase, to: GamePhase): void {
  if (from !== to && !canTransition(from, to))
    throw new Error(`Illegal phase transition ${from} → ${to}`);
}
