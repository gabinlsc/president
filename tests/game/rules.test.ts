import { describe, expect, it } from 'vitest';
import { apply, asPlaying, card, pass, play, playing, reject, run } from './helpers';

describe('Contrainte de format', () => {
  it('un pli lancé en paires impose des paires de valeur supérieure ou égale', () => {
    const state = playing([
      [card(6), card(6, 'hearts'), card(9)],
      [card(5), card(5, 'hearts'), card(7), card(7, 'hearts'), card(7, 'spades'), card(15)],
    ]);
    const after = apply(state, play('p0', card(6), card(6, 'hearts'))).state;
    reject(after, play('p1', card(7)), 'FORMAT_MISMATCH');
    reject(after, play('p1', card(15)), 'FORMAT_MISMATCH');
    reject(after, play('p1', card(7), card(7, 'hearts'), card(7, 'spades')), 'FORMAT_MISMATCH');
    reject(after, play('p1', card(5), card(5, 'hearts')), 'RANK_TOO_LOW');
    const next = asPlaying(apply(after, play('p1', card(7), card(7, 'hearts'))).state);
    expect(next.trick).toMatchObject({ format: 2, rank: 7, ownerId: 'p1' });
  });

  it('refuse les sélections invalides : valeurs mélangées, cartes absentes, doublons, vide', () => {
    const state = playing([[card(3), card(4)], [card(5)]]);
    reject(state, play('p0', card(3), card(4)), 'MIXED_RANKS');
    reject(state, play('p0', card(5)), 'CARDS_NOT_IN_HAND');
    reject(
      state,
      { type: 'play', playerId: 'p0', cards: ['3-clubs', '3-clubs'] },
      'INVALID_SELECTION',
    );
    reject(state, { type: 'play', playerId: 'p0', cards: [] }, 'INVALID_SELECTION');
    reject(state, { type: 'play', playerId: 'ghost', cards: ['3-clubs'] }, 'UNKNOWN_PLAYER');
  });

  it('un carré ne s’ouvre pas : il sert uniquement à couper', () => {
    const quad = [card(8), card(8, 'diamonds'), card(8, 'hearts'), card(8, 'spades')];
    reject(playing([[...quad, card(3)], [card(4)]]), play('p0', ...quad), 'SQUARE_MUST_CUT');
  });

  it('hors tour, seule une coupe est permise', () => {
    const state = playing([[card(3), card(9)], [card(5)], [card(6)]]);
    reject(state, play('p1', card(5)), 'NOT_YOUR_TURN');
  });
});

describe('Le 2', () => {
  it('remporte le pli et nettoie la table : son auteur relance', () => {
    const { state, events } = run(playing([[card(3), card(4)], [card(15), card(5)], [card(6)]]), [
      play('p0', card(3)),
      play('p1', card(15)),
    ]);
    const game = asPlaying(state);
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p1');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'two', leaderId: 'p1' }),
    );
  });

  it('respecte lui aussi le format : une paire de 2 sur une paire', () => {
    const state = run(
      playing([
        [card(6), card(6, 'hearts'), card(3)],
        [card(15), card(15, 'hearts'), card(4)],
      ]),
      [play('p0', card(6), card(6, 'hearts'))],
    ).state;
    reject(state, play('p1', card(15)), 'FORMAT_MISMATCH');
    const after = asPlaying(apply(state, play('p1', card(15), card(15, 'hearts'))).state);
    expect(after.trick).toBeNull();
    expect(after.turn).toBe('p1');
  });

  it('respecte la contrainte « même carte »', () => {
    const state = run(
      playing([
        [card(6), card(3)],
        [card(6, 'hearts'), card(4)],
        [card(15), card(5)],
      ]),
      [play('p0', card(6)), play('p1', card(6, 'hearts'))],
    ).state;
    reject(state, play('p2', card(15)), 'SAME_RANK_REQUIRED');
  });
});

describe('Dame de Pique (Reverse)', () => {
  it('inverse immédiatement le sens de rotation', () => {
    const { state, events } = apply(
      playing([[card(12, 'spades'), card(3)], [card(13)], [card(14)], [card(4)]]),
      play('p0', card(12, 'spades')),
    );
    const game = asPlaying(state);
    expect(game.isReversed).toBe(true);
    expect(game.turn).toBe('p3');
    expect(events).toContainEqual({ type: 'reversed', isReversed: true });
  });

  it('une seconde inversion rétablit le sens normal', () => {
    const game = asPlaying(
      run(
        playing([
          [card(12, 'spades'), card(3)],
          [card(4), card(5)],
          [card(13), card(6)],
          [card(14), card(7)],
        ]),
        [play('p0', card(12, 'spades')), play('p3', card(14))],
      ).state,
    );
    expect(game.turn).toBe('p2');
    const restored = asPlaying(
      apply(
        playing([[card(3)], [card(12, 'spades'), card(4)], [card(5)]], {
          isReversed: true,
          turn: 'p1',
        }),
        play('p1', card(12, 'spades')),
      ).state,
    );
    expect(restored.isReversed).toBe(false);
    expect(restored.turn).toBe('p2');
  });

  it('inverse aussi quand elle est posée dans une paire', () => {
    const game = asPlaying(
      apply(
        playing([[card(12, 'spades'), card(12, 'clubs'), card(3)], [card(4)], [card(5)]]),
        play('p0', card(12, 'spades'), card(12, 'clubs')),
      ).state,
    );
    expect(game.isReversed).toBe(true);
    expect(game.turn).toBe('p2');
  });
});

describe('Contrainte « même carte »', () => {
  const hands = () => [
    [card(6), card(9)],
    [card(6, 'hearts'), card(10)],
    [card(6, 'spades'), card(7)],
    [card(8), card(11)],
  ];

  it('A (6) → B (6) : C doit jouer un 6 ou passer; s’il joue un 6, D subit la contrainte', () => {
    const afterB = run(playing(hands()), [
      play('p0', card(6)),
      play('p1', card(6, 'hearts')),
    ]).state;
    expect(asPlaying(afterB).trick?.sameRankRequired).toBe(true);
    reject(afterB, play('p2', card(7)), 'SAME_RANK_REQUIRED');
    const afterC = asPlaying(apply(afterB, play('p2', card(6, 'spades'))).state);
    expect(afterC.trick?.sameRankRequired).toBe(true);
    reject(afterC, play('p3', card(8)), 'SAME_RANK_REQUIRED');
  });

  it('une passe lève la contrainte pour le joueur suivant', () => {
    const afterB = run(playing(hands()), [
      play('p0', card(6)),
      play('p1', card(6, 'hearts')),
    ]).state;
    const afterPass = asPlaying(apply(afterB, pass('p2')).state);
    expect(afterPass.trick?.sameRankRequired).toBe(false);
    expect(afterPass.turn).toBe('p3');
    const next = asPlaying(apply(afterPass, play('p3', card(8))).state);
    expect(next.trick).toMatchObject({ rank: 8, sameRankRequired: false });
  });

  it('une valeur strictement supérieure ne déclenche pas la contrainte', () => {
    const game = asPlaying(
      run(playing(hands()), [play('p0', card(6)), play('p1', card(10))]).state,
    );
    expect(game.trick?.sameRankRequired).toBe(false);
  });
});

describe('Couper (Carré)', () => {
  it('hors tour, trois cartes complètent un simple : la table est nettoyée et le coupeur relance', () => {
    const { state, events } = run(
      playing([
        [card(6), card(9)],
        [card(10)],
        [card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades'), card(7)],
      ]),
      [play('p0', card(6)), play('p2', card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades'))],
    );
    const game = asPlaying(state);
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p2');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'played', playerId: 'p2', outOfTurn: true }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'square', leaderId: 'p2' }),
    );
  });

  it('une paire complète deux simples consécutifs de même valeur', () => {
    const game = asPlaying(
      run(
        playing([
          [card(6), card(9)],
          [card(6, 'hearts'), card(10)],
          [card(3), card(4)],
          [card(6, 'spades'), card(6, 'diamonds'), card(7)],
        ]),
        [
          play('p0', card(6)),
          play('p1', card(6, 'hearts')),
          play('p3', card(6, 'spades'), card(6, 'diamonds')),
        ],
      ).state,
    );
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p3');
  });

  it('une paire coupe un pli lancé en paires', () => {
    const game = asPlaying(
      run(
        playing([
          [card(6), card(6, 'hearts'), card(9)],
          [card(10), card(11)],
          [card(6, 'spades'), card(6, 'diamonds'), card(7)],
        ]),
        [
          play('p0', card(6), card(6, 'hearts')),
          play('p2', card(6, 'spades'), card(6, 'diamonds')),
        ],
      ).state,
    );
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p2');
  });

  it('interdit toute coupe sur un pli commencé en triples', () => {
    const state = apply(
      playing([
        [card(6), card(6, 'hearts'), card(6, 'diamonds'), card(9)],
        [card(10)],
        [card(6, 'spades'), card(7)],
      ]),
      play('p0', card(6), card(6, 'hearts'), card(6, 'diamonds')),
    ).state;
    reject(state, play('p2', card(6, 'spades')), 'NOT_YOUR_TURN');
  });

  it('interdit la coupe sur un pli commencé en triples même après une surenchère', () => {
    const state = run(
      playing([
        [card(5), card(5, 'hearts'), card(5, 'diamonds'), card(3)],
        [card(6), card(6, 'hearts'), card(6, 'diamonds'), card(4)],
        [card(10), card(11)],
        [card(6, 'spades'), card(8)],
      ]),
      [
        play('p0', card(5), card(5, 'hearts'), card(5, 'diamonds')),
        play('p1', card(6), card(6, 'hearts'), card(6, 'diamonds')),
      ],
    ).state;
    reject(state, play('p3', card(6, 'spades')), 'NOT_YOUR_TURN');
  });

  it('un joueur qui a passé peut revenir dans le pli en coupant', () => {
    const game = asPlaying(
      run(
        playing([
          [card(6), card(9)],
          [card(6, 'hearts'), card(6, 'spades'), card(6, 'diamonds'), card(10)],
          [card(7), card(11)],
        ]),
        [
          play('p0', card(6)),
          pass('p1'),
          play('p1', card(6, 'hearts'), card(6, 'spades'), card(6, 'diamonds')),
        ],
      ).state,
    );
    expect(game.passed).toEqual([]);
    expect(game.turn).toBe('p1');
  });

  it('on ne coupe pas sur ses propres cartes', () => {
    const state = apply(
      playing([
        [card(6), card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades'), card(9)],
        [card(10), card(11)],
        [card(12), card(13)],
      ]),
      play('p0', card(6)),
    ).state;
    reject(
      state,
      play('p0', card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades')),
      'NOT_YOUR_TURN',
    );
  });

  it('on peut couper si un autre joueur a posé la dernière carte de la série', () => {
    const game = asPlaying(
      run(
        playing([
          [card(6), card(6, 'diamonds'), card(6, 'spades'), card(9)],
          [card(6, 'hearts'), card(11)],
          [card(12), card(13)],
        ]),
        [
          play('p0', card(6)),
          play('p1', card(6, 'hearts')),
          play('p0', card(6, 'diamonds'), card(6, 'spades')),
        ],
      ).state,
    );
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p0');
  });

  it('la série est rompue par une autre valeur : pas de coupe', () => {
    const state = run(
      playing([
        [card(6), card(9)],
        [card(7), card(10)],
        [card(11), card(13)],
        [card(6, 'hearts'), card(6, 'spades'), card(6, 'diamonds'), card(3)],
      ]),
      [play('p0', card(6)), play('p1', card(7))],
    ).state;
    reject(
      state,
      play('p3', card(6, 'hearts'), card(6, 'spades'), card(6, 'diamonds')),
      'NOT_YOUR_TURN',
    );
  });

  it('un carré complété à son tour par égalités nettoie aussi la table', () => {
    const { state, events } = run(
      playing([
        [card(6), card(3)],
        [card(6, 'hearts'), card(4)],
        [card(6, 'spades'), card(5)],
        [card(6, 'diamonds'), card(7)],
      ]),
      [
        play('p0', card(6)),
        play('p1', card(6, 'hearts')),
        play('p2', card(6, 'spades')),
        play('p3', card(6, 'diamonds')),
      ],
    );
    expect(asPlaying(state).trick).toBeNull();
    expect(asPlaying(state).turn).toBe('p3');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'square' }),
    );
  });
});

describe('Passes', () => {
  it('quand tous les autres passent, le dernier poseur relance', () => {
    const { state, events } = run(playing([[card(3), card(7)], [card(4)], [card(5)]]), [
      play('p0', card(3)),
      pass('p1'),
      pass('p2'),
    ]);
    const game = asPlaying(state);
    expect(game.trick).toBeNull();
    expect(game.turn).toBe('p0');
    expect(game.passed).toEqual([]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'trickCleared', reason: 'allPassed', leaderId: 'p0' }),
    );
  });

  it('un joueur ayant passé est sauté jusqu’au nettoyage', () => {
    const game = asPlaying(
      run(
        playing([
          [card(3), card(8), card(13)],
          [card(4), card(9)],
          [card(5), card(10)],
        ]),
        [play('p0', card(3)), pass('p1'), play('p2', card(5))],
      ).state,
    );
    expect(game.turn).toBe('p0');
    const after = asPlaying(apply(game, play('p0', card(8))).state);
    expect(after.turn).toBe('p2');
  });

  it('refuse une passe hors tour', () => {
    const state = apply(
      playing([[card(3), card(8)], [card(4)], [card(5)]]),
      play('p0', card(3)),
    ).state;
    reject(state, pass('p2'), 'NOT_YOUR_TURN');
  });
});
