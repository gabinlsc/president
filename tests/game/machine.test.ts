import { describe, expect, it } from 'vitest';
import {
  ACTION_PHASES,
  PHASE_TRANSITIONS,
  canTransition,
  createGame,
  makeDeck,
  shuffle,
  transition,
} from '@president/game';
import { DECK_SIZE, GAME_PHASES, QUEEN_OF_HEARTS, type GameState } from '@president/shared';
import { allCardIds, apply, asPlaying, card, pass, play, playing, reject, run } from './helpers';

const seated = (count: number): GameState =>
  run(
    createGame(),
    Array.from({ length: count }, (_, i) => ({ type: 'seat', playerId: `p${i}`, name: `J${i}` })),
  ).state;

describe('Machine à états', () => {
  it('déclare uniquement le cycle Lobby → Distribution → Échanges → Jeu → Fin de manche', () => {
    expect(PHASE_TRANSITIONS).toEqual({
      lobby: ['dealing'],
      dealing: ['exchanging', 'playing'],
      exchanging: ['playing'],
      playing: ['roundOver'],
      roundOver: ['dealing'],
    });
    for (const from of GAME_PHASES)
      for (const to of GAME_PHASES)
        expect(canTransition(from, to)).toBe(PHASE_TRANSITIONS[from].includes(to));
  });

  it('chaque action appartient à une seule phase et est refusée ailleurs', () => {
    expect(ACTION_PHASES).toEqual({
      seat: 'lobby',
      unseat: 'lobby',
      start: 'lobby',
      completeDeal: 'dealing',
      exchange: 'exchanging',
      play: 'playing',
      pass: 'playing',
      nextRound: 'roundOver',
    });
    const lobby = seated(3);
    reject(lobby, play('p0', card(3)), 'WRONG_PHASE');
    reject(lobby, pass('p0'), 'WRONG_PHASE');
    reject(lobby, { type: 'completeDeal' }, 'WRONG_PHASE');
    reject(lobby, { type: 'nextRound', seed: 1 }, 'WRONG_PHASE');
    reject(playing([[card(3)], [card(4)]]), { type: 'start', seed: 1 }, 'WRONG_PHASE');
    reject(
      playing([[card(3)], [card(4)]]),
      { type: 'seat', playerId: 'x', name: 'X' },
      'WRONG_PHASE',
    );
  });

  it('gère les sièges du lobby : doublons, table pleine, départ', () => {
    const lobby = seated(8);
    reject(lobby, { type: 'seat', playerId: 'p9', name: 'Neuf' }, 'TABLE_FULL');
    reject(seated(2), { type: 'seat', playerId: 'p1', name: 'Bis' }, 'DUPLICATE_PLAYER');
    reject(seated(2), { type: 'unseat', playerId: 'ghost' }, 'UNKNOWN_PLAYER');
    expect(
      apply(seated(3), { type: 'unseat', playerId: 'p1' }).state.seats.map((s) => s.id),
    ).toEqual(['p0', 'p2']);
  });

  it('refuse de lancer une table de moins de 2 joueurs', () => {
    reject(seated(1), { type: 'start', seed: 1 }, 'NOT_ENOUGH_PLAYERS');
  });

  it('distribue les 52 cartes de façon équilibrée et déterministe pour une graine', () => {
    for (const count of [2, 3, 5, 8]) {
      const { state, events } = apply(seated(count), { type: 'start', seed: 42 });
      expect(state.phase).toBe('dealing');
      expect(state.round).toBe(1);
      expect(events).toEqual([{ type: 'dealt', round: 1 }]);
      const ids = allCardIds(state);
      expect(ids).toHaveLength(DECK_SIZE);
      expect(new Set(ids).size).toBe(DECK_SIZE);
      const sizes = state.seats.map((s) => s.hand.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(apply(seated(count), { type: 'start', seed: 42 }).state).toEqual(state);
    }
    expect(makeDeck()).toHaveLength(DECK_SIZE);
    expect(shuffle(makeDeck(), 7)).not.toEqual(shuffle(makeDeck(), 8));
  });

  it('la Dame de cœur débute la première manche', () => {
    const dealt = apply(seated(4), { type: 'start', seed: 3 }).state;
    const game = asPlaying(apply(dealt, { type: 'completeDeal' }).state);
    const holder = game.seats.find((s) => s.hand.some((c) => c.id === QUEEN_OF_HEARTS))!;
    expect(game.turn).toBe(holder.id);
    expect(game.mustOpenWith).toBe(QUEEN_OF_HEARTS);
    expect(game.trick).toBeNull();
  });

  it('l’ouverture doit contenir la Dame de cœur et ne peut pas être passée', () => {
    const state = playing(
      [[card(12, 'hearts'), card(12, 'clubs'), card(3)], [card(4)], [card(5)]],
      {
        mustOpenWith: QUEEN_OF_HEARTS,
      },
    );
    reject(state, play('p0', card(3)), 'MUST_OPEN_WITH');
    reject(state, pass('p0'), 'CANNOT_PASS_ON_LEAD');
    const opened = asPlaying(apply(state, play('p0', card(12, 'hearts'), card(12, 'clubs'))).state);
    expect(opened.mustOpenWith).toBeNull();
    expect(opened.trick?.format).toBe(2);
  });

  it('ne mute jamais l’état reçu, même quand l’action est refusée', () => {
    const state = playing([[card(3), card(4)], [card(5)]]);
    const snapshot = structuredClone(state);
    expect(transition(state, play('p1', card(5))).ok).toBe(false);
    expect(transition(state, play('p0', card(3))).ok).toBe(true);
    expect(state).toEqual(snapshot);
  });
});
