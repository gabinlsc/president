import { describe, expect, it } from 'vitest';
import { chooseBotAction, createGame, legalPlays, toGameView, transition } from '@president/game';
import { DECK_SIZE, QUEEN_OF_HEARTS, type GameAction, type GameState } from '@president/shared';
import { apply, card, play, playing, run } from './helpers';

describe('Vue par joueur', () => {
  it('ne révèle que la main du destinataire et les comptes publics', () => {
    const state = playing([[card(3), card(4)], [card(5)], [card(6), card(7), card(8)]]);
    const view = toGameView(state, 'p1');
    expect(view.hand.map((c) => c.id)).toEqual(['5-clubs']);
    expect(view.seats.map((s) => s.cardCount)).toEqual([2, 1, 3]);
    expect(JSON.stringify(view)).not.toContain('3-clubs');
    expect(view.canPass).toBe(false);
    expect(view.legalPlays).toEqual([]);
    expect(toGameView(state, 'p0').legalPlays).toEqual([['3-clubs'], ['4-clubs']]);
  });

  it('propose la coupe hors tour et l’ouverture imposée', () => {
    const state = apply(
      playing([
        [card(6), card(9)],
        [card(10)],
        [card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades')],
      ]),
      play('p0', card(6)),
    ).state;
    expect(legalPlays(state, 'p2')).toEqual([['6-hearts', '6-diamonds', '6-spades']]);
    const opening = playing([[card(12, 'hearts'), card(12, 'spades'), card(3)], [card(4)]], {
      mustOpenWith: QUEEN_OF_HEARTS,
    });
    expect(legalPlays(opening, 'p0')).toEqual([['12-hearts'], ['12-hearts', '12-spades']]);
  });

  it('décrit l’échange attendu du destinataire', () => {
    const exchanging = run(
      {
        phase: 'roundOver',
        round: 1,
        isReversed: false,
        seats: [
          { id: 'p0', name: 'A', hand: [], role: 'president' },
          { id: 'p1', name: 'B', hand: [], role: 'trouduc' },
        ],
        ranking: ['p0', 'p1'],
        penalized: [],
      },
      [{ type: 'nextRound', seed: 5 }, { type: 'completeDeal' }],
    ).state;
    expect(toGameView(exchanging, 'p0').exchange).toEqual({
      partnerId: 'p1',
      give: 2,
      forced: false,
      submitted: false,
      reserved: [],
    });
    const forced = toGameView(exchanging, 'p1').exchange!;
    expect(forced).toMatchObject({ partnerId: 'p0', give: 2, forced: true, submitted: true });
    expect(forced.reserved).toHaveLength(2);
    expect(toGameView(exchanging, 'p1').pendingExchanges).toBe(1);
  });
});

function seeded(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** Picks who acts next: the player to move, or the first pending exchanger. */
function nextActor(state: GameState): string | null {
  if (state.phase === 'playing') return state.turn;
  if (state.phase === 'exchanging')
    return state.transfers.find((t) => t.cards === null)?.fromId ?? null;
  return null;
}

describe('Bots', () => {
  it('jouent des parties complètes de 2 à 8 joueurs sans blocage ni perte de cartes', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 8])
      for (let seed = 1; seed <= 5; seed++) {
        const random = seeded(seed * 31 + count);
        let state: GameState = createGame();
        for (let i = 0; i < count; i++)
          state = apply(state, { type: 'seat', playerId: `b${i}`, name: `Bot ${i}` }).state;
        state = apply(state, { type: 'start', seed }).state;
        for (let round = 1; round <= 3; round++) {
          state = apply(state, { type: 'completeDeal' }).state;
          let steps = 0;
          while (state.phase !== 'roundOver') {
            expect(steps++).toBeLessThan(2000);
            // Out-of-turn squares are offered to every bot before the player to move acts.
            const current = state;
            const turn = current.phase === 'playing' ? current.turn : null;
            const cutter =
              turn === null
                ? undefined
                : current.seats.find(
                    (s) =>
                      s.id !== turn &&
                      chooseBotAction(current, s.id)?.type === 'play' &&
                      random() < 0.5,
                  );
            const actor = cutter?.id ?? nextActor(state);
            expect(actor).not.toBeNull();
            const action: GameAction | null = chooseBotAction(state, actor!);
            expect(action, `bot ${actor} must act in ${state.phase}`).not.toBeNull();
            const result = transition(state, action!);
            if (!result.ok) throw new Error(`${actor}: ${result.error.code}`);
            state = result.state;
            const held = state.seats.flatMap((s) => s.hand.map((c) => c.id));
            expect(new Set(held).size).toBe(held.length);
          }
          expect(new Set(state.ranking).size).toBe(count);
          state = apply(state, { type: 'nextRound', seed: seed + round }).state;
          expect(state.seats.flatMap((s) => s.hand)).toHaveLength(DECK_SIZE);
        }
      }
  });

  it('ne gaspille pas un 2 quand une petite carte suffit', () => {
    expect(chooseBotAction(playing([[card(3), card(15), card(9)], [card(4)]]), 'p0')).toEqual(
      play('p0', card(3)),
    );
  });

  it('coupe hors tour quand il le peut', () => {
    const state = apply(
      playing([
        [card(6), card(9)],
        [card(10)],
        [card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades'), card(3)],
      ]),
      play('p0', card(6)),
    ).state;
    expect(chooseBotAction(state, 'p2')?.type).toBe('play');
  });

  it('n’agit pas quand rien ne lui est demandé', () => {
    const state = playing([[card(3), card(9)], [card(10)], [card(4)]]);
    expect(chooseBotAction(state, 'p1')).toBeNull();
    expect(chooseBotAction(createGame(), 'p0')).toBeNull();
  });
});
