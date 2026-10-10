import { describe, expect, it } from 'vitest';
import type { GameState, RoundOverState } from '@president/shared';
import { apply, asPlaying, card, pass, play, playing, run } from './helpers';

const roles = (state: GameState) => Object.fromEntries(state.seats.map((s) => [s.id, s.role]));
const asRoundOver = (state: GameState) => {
  expect(state.phase).toBe('roundOver');
  return state as RoundOverState;
};

describe('Arrêt sur victoire', () => {
  it('le premier à finir (Président) arrête le pli : son voisin encore en jeu relance', () => {
    const { state, events } = apply(
      playing([[card(3)], [card(4), card(8)], [card(5), card(9)], [card(6), card(10)]]),
      play('p0', card(3)),
    );
    const game = asPlaying(state);
    expect(game.finished).toEqual(['p0']);
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p1');
    expect(events).toContainEqual({ type: 'playerFinished', playerId: 'p0', penalized: false });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'presidentOut', leaderId: 'p1' }),
    );
  });

  it('les suivants qui finissent ne coupent pas le pli : leur tour est simplement sauté', () => {
    const start = playing([[], [card(4)], [card(5), card(9)], [card(6), card(10)]], {
      finished: ['p0'],
      turn: 'p1',
    });
    const { state, events } = apply(start, play('p1', card(4)));
    const game = asPlaying(state);
    expect(game.finished).toEqual(['p0', 'p1']);
    expect(game.trick).toMatchObject({ ownerId: 'p1', rank: 4 });
    expect(game.turn).toBe('p2');
    expect(events.some((e) => e.type === 'trickCleared')).toBe(false);
  });

  it('si tous passent derrière un joueur sorti, le joueur actif suivant relance', () => {
    const start = playing(
      [[], [card(4)], [card(5), card(9)], [card(6), card(10)], [card(7), card(11)]],
      {
        finished: ['p0'],
        turn: 'p1',
      },
    );
    const { state, events } = run(start, [play('p1', card(4)), pass('p2'), pass('p3'), pass('p4')]);
    const game = asPlaying(state);
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p2');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'allPassed', leaderId: 'p2' }),
    );
  });

  it('un joueur sorti n’est jamais désigné pour jouer, dans les deux sens', () => {
    const start = playing([[card(3), card(7)], [], [card(5), card(9)], [], [card(6), card(10)]], {
      finished: ['p1', 'p3'],
    });
    expect(asPlaying(apply(start, play('p0', card(3))).state).turn).toBe('p2');
    const reversed = playing(
      [[card(3), card(7)], [], [card(5), card(9)], [], [card(6), card(10)]],
      {
        finished: ['p1', 'p3'],
        isReversed: true,
      },
    );
    expect(asPlaying(apply(reversed, play('p0', card(3))).state).turn).toBe('p4');
  });

  it('une sortie sur la Dame de pique fait relancer le voisin dans le nouveau sens', () => {
    const game = asPlaying(
      apply(
        playing([[card(12, 'spades')], [card(13), card(3)], [card(14), card(4)]]),
        play('p0', card(12, 'spades')),
      ).state,
    );
    expect(game.isReversed).toBe(true);
    expect(game.turn).toBe('p2');
    expect(game.trick).toBeNull();
  });

  it('une coupe pour sortir nettoie la table et ne laisse pas rejouer le joueur sorti', () => {
    const { state, events } = run(
      playing([
        [card(6), card(9)],
        [card(10), card(11)],
        [card(6, 'hearts'), card(6, 'spades'), card(6, 'diamonds')],
      ]),
      [play('p0', card(6)), play('p2', card(6, 'hearts'), card(6, 'spades'), card(6, 'diamonds'))],
    );
    const game = asPlaying(state);
    expect(game.finished).toEqual(['p2']);
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p0');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'square', leaderId: 'p0' }),
    );
  });
});

describe('Punition du 2', () => {
  it('finir sur un 2 rend Trou du cul d’office, même en sortant premier', () => {
    const { state } = run(playing([[card(15)], [card(3)], [card(4), card(5)]]), [
      play('p0', card(15)),
      play('p1', card(3)),
    ]);
    const over = asRoundOver(state);
    expect(over.ranking).toEqual(['p1', 'p2', 'p0']);
    expect(roles(over)).toEqual({ p1: 'president', p2: 'neutral', p0: 'trouduc' });
  });

  it('un joueur puni ne devient pas Président : le premier non puni arrête le pli', () => {
    const { state, events } = run(
      playing([[card(15)], [card(3)], [card(5), card(6)], [card(7), card(8)]]),
      [play('p0', card(15)), play('p1', card(3))],
    );
    const game = asPlaying(state);
    expect(game.penalized).toEqual(['p0']);
    expect(game.finished).toEqual(['p1']);
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p2');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'presidentOut' }),
    );
  });

  it('plusieurs punis sont classés derrière tous les autres, le dernier puni en dernier', () => {
    const { state, events } = run(
      playing([[card(15)], [card(15, 'hearts')], [card(3)], [card(4), card(5)]]),
      [play('p0', card(15)), play('p1', card(15, 'hearts')), play('p2', card(3))],
    );
    const over = asRoundOver(state);
    expect(over.ranking).toEqual(['p2', 'p3', 'p0', 'p1']);
    expect(roles(over)).toEqual({
      p2: 'president',
      p3: 'vice-president',
      p0: 'vice-trouduc',
      p1: 'trouduc',
    });
    expect(events).toContainEqual({ type: 'roundOver', ranking: ['p2', 'p3', 'p0', 'p1'] });
  });
});

describe('Fin de manche et rôles', () => {
  it('à 2 joueurs : Président et Trou du cul', () => {
    const over = asRoundOver(
      apply(playing([[card(3)], [card(4), card(5)]]), play('p0', card(3))).state,
    );
    expect(over.ranking).toEqual(['p0', 'p1']);
    expect(roles(over)).toEqual({ p0: 'president', p1: 'trouduc' });
  });

  it('à 3 joueurs : pas de vice-rôles', () => {
    const over = asRoundOver(
      run(playing([[card(3)], [card(4)], [card(5), card(6)]]), [
        play('p0', card(3)),
        play('p1', card(4)),
      ]).state,
    );
    expect(over.ranking).toEqual(['p0', 'p1', 'p2']);
    expect(roles(over)).toEqual({ p0: 'president', p1: 'neutral', p2: 'trouduc' });
  });

  it('à 5 joueurs : Président, Vice-président, Citoyen, Vice-trouduc, Trou du cul', () => {
    const start = playing([[], [], [], [card(3)], [card(4), card(5)]], {
      finished: ['p0', 'p1', 'p2'],
      turn: 'p3',
    });
    const over = asRoundOver(apply(start, play('p3', card(3))).state);
    expect(over.ranking).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(roles(over)).toEqual({
      p0: 'president',
      p1: 'vice-president',
      p2: 'neutral',
      p3: 'vice-trouduc',
      p4: 'trouduc',
    });
  });
});
