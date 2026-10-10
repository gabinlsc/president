import { describe, expect, it } from 'vitest';
import type { CardId, ExchangingState, GameState, Role, RoundOverState } from '@president/shared';
import { DECK_SIZE } from '@president/shared';
import { allCardIds, apply, asPlaying, handOf, reject } from './helpers';

function roundOver(order: Role[], isReversed = true): RoundOverState {
  return {
    phase: 'roundOver',
    round: 1,
    isReversed,
    seats: order.map((role, i) => ({ id: `p${i}`, name: `J${i}`, hand: [], role })),
    ranking: order.map((_, i) => `p${i}`),
    penalized: [],
  };
}
const fourRoles: Role[] = ['president', 'vice-president', 'vice-trouduc', 'trouduc'];

const toExchange = (state: GameState): ExchangingState => {
  const dealing = apply(state, { type: 'nextRound', seed: 99 }).state;
  const exchanging = apply(dealing, { type: 'completeDeal' }).state;
  expect(exchanging.phase).toBe('exchanging');
  return exchanging as ExchangingState;
};
const rankOf = (id: CardId) => Number(id.split('-')[0]);
const topRanks = (state: GameState, id: string, count: number) =>
  state.seats
    .find((s) => s.id === id)!
    .hand.map((c) => c.rank)
    .sort((a, b) => b - a)
    .slice(0, count);

describe('Échanges post-manche', () => {
  it('la manche suivante redistribue, remet le sens à l’endroit et réserve les meilleures cartes des perdants', () => {
    const { state, events } = apply(roundOver(fourRoles), { type: 'nextRound', seed: 99 });
    expect(state.phase).toBe('dealing');
    expect(state.round).toBe(2);
    expect(state.isReversed).toBe(false);
    expect(events).toEqual([{ type: 'dealt', round: 2 }]);
    expect(allCardIds(state)).toHaveLength(DECK_SIZE);
    if (state.phase !== 'dealing') throw new Error('unreachable');
    const byGiver = Object.fromEntries(state.transfers.map((t) => [t.fromId, t]));
    expect(Object.keys(byGiver).sort()).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(byGiver.p3).toMatchObject({ toId: 'p0', count: 2, forced: true });
    expect(byGiver.p2).toMatchObject({ toId: 'p1', count: 1, forced: true });
    expect(byGiver.p0).toMatchObject({ toId: 'p3', count: 2, forced: false, cards: null });
    expect(byGiver.p1).toMatchObject({ toId: 'p2', count: 1, forced: false, cards: null });
    expect(byGiver.p3!.cards!.map(rankOf).sort((a, b) => b - a)).toEqual(topRanks(state, 'p3', 2));
    expect(byGiver.p2!.cards!.map(rankOf)).toEqual(topRanks(state, 'p2', 1));
  });

  it('seuls le Président et le Vice-président choisissent, avec le bon nombre de cartes', () => {
    const state = toExchange(roundOver(fourRoles));
    const p0 = handOf(state, 'p0');
    reject(
      state,
      { type: 'exchange', playerId: 'p3', cards: handOf(state, 'p3').slice(0, 2) },
      'NO_EXCHANGE_EXPECTED',
    );
    reject(state, { type: 'exchange', playerId: 'p0', cards: p0.slice(0, 1) }, 'WRONG_CARD_COUNT');
    reject(
      state,
      { type: 'exchange', playerId: 'p0', cards: [handOf(state, 'p1')[0]!, p0[0]!] },
      'CARDS_NOT_IN_HAND',
    );
    const once = apply(state, { type: 'exchange', playerId: 'p0', cards: p0.slice(0, 2) }).state;
    expect(once.phase).toBe('exchanging');
    reject(
      once,
      { type: 'exchange', playerId: 'p0', cards: p0.slice(2, 4) },
      'EXCHANGE_ALREADY_SUBMITTED',
    );
  });

  it('les transferts sont simultanés, conservent 52 cartes et le Trou du cul ouvre', () => {
    const state = toExchange(roundOver(fourRoles));
    const forced = Object.fromEntries(
      state.transfers.filter((t) => t.forced).map((t) => [t.fromId, t.cards!]),
    );
    const before = Object.fromEntries(state.seats.map((s) => [s.id, s.hand.length]));
    const presidentGift = handOf(state, 'p0').slice(0, 2);
    const viceGift = handOf(state, 'p1').slice(0, 1);
    const afterPresident = apply(state, {
      type: 'exchange',
      playerId: 'p0',
      cards: presidentGift,
    }).state;
    const { state: done, events } = apply(afterPresident, {
      type: 'exchange',
      playerId: 'p1',
      cards: viceGift,
    });
    const game = asPlaying(done);
    expect(events).toContainEqual({ type: 'exchanged' });
    expect(game.turn).toBe('p3');
    expect(game.trick).toBeNull();
    expect(handOf(game, 'p0')).toEqual(expect.arrayContaining([...forced.p3!]));
    expect(handOf(game, 'p0')).not.toEqual(expect.arrayContaining([presidentGift[0]]));
    expect(handOf(game, 'p3')).toEqual(expect.arrayContaining(presidentGift));
    expect(handOf(game, 'p1')).toEqual(expect.arrayContaining([...forced.p2!]));
    expect(handOf(game, 'p2')).toEqual(expect.arrayContaining(viceGift));
    expect(Object.fromEntries(game.seats.map((s) => [s.id, s.hand.length]))).toEqual(before);
    expect(new Set(allCardIds(game)).size).toBe(DECK_SIZE);
  });

  it('à 2 joueurs, seul l’échange de deux cartes entre extrêmes a lieu', () => {
    const state = toExchange(roundOver(['president', 'trouduc']));
    expect(state.transfers.map((t) => [t.fromId, t.toId, t.count])).toEqual(
      expect.arrayContaining([
        ['p1', 'p0', 2],
        ['p0', 'p1', 2],
      ]),
    );
    expect(state.transfers).toHaveLength(2);
    const game = asPlaying(
      apply(state, { type: 'exchange', playerId: 'p0', cards: handOf(state, 'p0').slice(0, 2) })
        .state,
    );
    expect(game.turn).toBe('p1');
  });

  it('à 3 joueurs, le Citoyen n’échange rien', () => {
    const state = toExchange(roundOver(['president', 'neutral', 'trouduc']));
    expect(state.transfers).toHaveLength(2);
    reject(
      state,
      { type: 'exchange', playerId: 'p1', cards: handOf(state, 'p1').slice(0, 1) },
      'NO_EXCHANGE_EXPECTED',
    );
  });
});
