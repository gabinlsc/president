import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomSnapshot } from '@president/shared';
import { resolveOptions } from '../../apps/server/src/config';
import { RoomService } from '../../apps/server/src/rooms/RoomService';
import { card, playing } from '../game/helpers';

const PACING = { dealDelay: 1500, botDelay: 800, clearPause: 1000 };

function service() {
  const published: { socketId: string; snapshot: RoomSnapshot; at: number }[] = [];
  let seed = 1;
  const rooms = new RoomService(
    resolveOptions({ pacing: PACING, seed: () => seed++ }),
    (socketId, snapshot) => published.push({ socketId, snapshot, at: Date.now() }),
  );
  return { rooms, published };
}

describe('RoomService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('limite la table à 8 joueurs et nettoie les salons abandonnés', () => {
    const { rooms } = service();
    const host = rooms.create({ name: 'Hôte', mode: 'online' }, 's0');
    for (let i = 1; i < 8; i++) rooms.join({ code: host.code, name: `J${i}` }, `s${i}`);
    expect(() => rooms.join({ code: host.code, name: 'Neuf' }, 's9')).toThrow(/complète/);
    const room = rooms.store.get(host.code)!;
    for (const member of [...room.members.values()]) rooms.disconnect(room, member);
    rooms.cleanup(Date.now() + 29 * 60 * 1000);
    expect(rooms.store.size).toBe(1);
    rooms.cleanup(Date.now() + 31 * 60 * 1000);
    expect(rooms.store.size).toBe(0);
    expect(rooms.store.sessionCount).toBe(0);
    rooms.close();
  });

  it('laisse le temps d’animer la distribution, puis espace chaque coup de bot', () => {
    const { rooms, published } = service();
    const session = rooms.create({ name: 'Moi', mode: 'solo', bots: 4 }, 'human');
    const room = rooms.store.get(session.code)!;
    expect(room.game.phase).toBe('dealing');
    vi.advanceTimersByTime(PACING.dealDelay - 1);
    expect(room.game.phase).toBe('dealing');
    vi.advanceTimersByTime(1);
    expect(room.game.phase).toBe('playing');

    // The human plays its first legal move whenever asked; every bot move is timed.
    const human = room.members.get(session.playerId)!;
    const moves: { at: number; afterClear: boolean }[] = [];
    let last = Date.now();
    for (let i = 0; i < 3000 && room.game.phase === 'playing' && moves.length < 12; i++) {
      if (room.game.turn === session.playerId) {
        const [first] = rooms.snapshot(room, human.id).game.legalPlays;
        if (first) rooms.play(room, human, first);
        else rooms.pass(room, human);
        last = Date.now();
        continue;
      }
      const before = room.version;
      const afterClear = room.lastEvents.some((e) => e.type === 'trickCleared');
      vi.advanceTimersByTime(10);
      if (room.version !== before) {
        moves.push({ at: Date.now() - last, afterClear });
        last = Date.now();
      }
    }
    expect(published.length).toBeGreaterThan(1);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      const minimum = PACING.botDelay * 0.75 + (move.afterClear ? PACING.clearPause : 0);
      expect(move.at).toBeGreaterThanOrEqual(minimum - 10);
    }
    rooms.close();
  });

  it('gèle la table quand aucun humain n’est connecté', () => {
    const { rooms } = service();
    const session = rooms.create({ name: 'Moi', mode: 'solo', bots: 4 }, 'human');
    const room = rooms.store.get(session.code)!;
    rooms.disconnect(room, room.members.get(session.playerId)!);
    vi.advanceTimersByTime(60_000);
    expect(room.game.phase).toBe('dealing');
    rooms.resume(session.token, 'again');
    vi.advanceTimersByTime(PACING.dealDelay);
    expect(room.game.phase).toBe('playing');
    rooms.close();
  });

  it('un départ en cours de partie confie le siège à un bot; sans humain le salon disparaît', () => {
    const { rooms } = service();
    const host = rooms.create({ name: 'A', mode: 'online' }, 'sa');
    const guest = rooms.join({ code: host.code, name: 'B' }, 'sb');
    const room = rooms.store.get(host.code)!;
    rooms.start(room, room.members.get(host.playerId)!);
    rooms.leave(room, room.members.get(host.playerId)!);
    expect(room.members.get(host.playerId)!.isBot).toBe(true);
    expect(room.hostId).toBe(guest.playerId);
    rooms.leave(room, room.members.get(guest.playerId)!);
    expect(rooms.store.size).toBe(0);
    rooms.close();
  });

  it('dans le lobby, un départ libère le siège', () => {
    const { rooms } = service();
    const host = rooms.create({ name: 'A', mode: 'online' }, 'sa');
    rooms.join({ code: host.code, name: 'B' }, 'sb');
    const room = rooms.store.get(host.code)!;
    rooms.leave(room, room.members.get(host.playerId)!);
    expect(room.game.seats.map((s) => s.name)).toEqual(['B']);
    expect(room.members.size).toBe(1);
    rooms.close();
  });

  it('coupe automatiquement pour un humain qui l’a demandé, plus vite qu’un bot', () => {
    const { rooms } = service();
    const session = rooms.create({ name: 'Moi', mode: 'solo', bots: 4 }, 'human');
    const room = rooms.store.get(session.code)!;
    const ids = [...room.members.keys()];
    const crafted = playing([
      [card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades'), card(3)],
      [card(6), card(9)],
      [card(10), card(11)],
      [card(12), card(13)],
      [card(14), card(4)],
    ]);
    room.game = {
      ...crafted,
      seats: crafted.seats.map((s, i) => ({ ...s, id: ids[i]! })),
      turn: ids[1]!,
    };
    const human = room.members.get(session.playerId)!;
    rooms.setAutoCut(room, human, true);
    expect(rooms.snapshot(room, human.id).autoCut).toBe(true);
    // The bot on turn lays a 6: the square becomes possible for the human.
    vi.advanceTimersByTime(PACING.botDelay * 1.25);
    expect(room.game.phase === 'playing' && room.game.trick?.rank).toBe(6);
    vi.advanceTimersByTime(PACING.botDelay * 0.35);
    const game = room.game;
    expect(game.phase === 'playing' && game.trick).toBeNull();
    expect(game.seats.find((s) => s.id === human.id)!.hand).toHaveLength(1);
    rooms.close();
  });

  it('ne coupe jamais automatiquement sur ses propres cartes', () => {
    const { rooms } = service();
    const session = rooms.create({ name: 'Moi', mode: 'solo', bots: 4 }, 'human');
    const room = rooms.store.get(session.code)!;
    const ids = [...room.members.keys()];
    const crafted = playing([
      [card(6), card(6, 'hearts'), card(6, 'diamonds'), card(6, 'spades'), card(3)],
      [card(7), card(9)],
      [card(10), card(11)],
      [card(12), card(13)],
      [card(14), card(4)],
    ]);
    room.game = {
      ...crafted,
      seats: crafted.seats.map((s, i) => ({ ...s, id: ids[i]! })),
      turn: ids[0]!,
    };
    const human = room.members.get(session.playerId)!;
    rooms.setAutoCut(room, human, true);
    rooms.play(room, human, ['6-clubs']);
    vi.advanceTimersByTime(PACING.botDelay * 0.4);
    const game = room.game;
    expect(game.phase === 'playing' && game.trick?.ownerId).toBe(human.id);
    expect(game.seats.find((s) => s.id === human.id)!.hand).toHaveLength(4);
    rooms.close();
  });
});
