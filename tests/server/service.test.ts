import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomSnapshot } from '@president/shared';
import { resolveOptions } from '../../apps/server/src/config';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileResultSink, type RoundRecord } from '../../apps/server/src/results';
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

  it('laisse le temps à un humain de couper avant que les bots ne jouent', () => {
    const { rooms } = service();
    const session = rooms.create({ name: 'Moi', mode: 'solo', bots: 4 }, 'human');
    const room = rooms.store.get(session.code)!;
    const ids = [...room.members.keys()];
    const crafted = playing([
      [card(6, 'spades'), card(3)],
      [card(6), card(9)],
      [card(6, 'hearts'), card(11)],
      [card(6, 'diamonds'), card(13)],
      [card(14), card(4)],
    ]);
    room.game = {
      ...crafted,
      seats: crafted.seats.map((s, i) => ({ ...s, id: ids[i]! })),
      turn: ids[1]!,
    };
    const bot = room.members.get(ids[1]!)!;
    rooms.play(room, bot, ['6-clubs']);
    rooms.play(room, room.members.get(ids[2]!)!, ['6-hearts']);
    rooms.play(room, room.members.get(ids[3]!)!, ['6-diamonds']);
    // The human can now cut with the last 6: bots wait at least two thinking times more.
    vi.advanceTimersByTime(PACING.botDelay * 2);
    expect(room.game.phase === 'playing' && room.game.trick?.run).toBe(3);
    const human = room.members.get(session.playerId)!;
    rooms.play(room, human, ['6-spades']);
    expect(room.game.phase === 'playing' && room.game.trick).toBeNull();
    rooms.close();
  });
});

describe('Classement : une ligne par manche terminée', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Solo à 5 : l'humain a un as seul et finit premier, les bots finissent la manche. */
  function nearEnd(onRecord: (r: RoundRecord) => void) {
    let seed = 1;
    const rooms = new RoomService(
      resolveOptions({ pacing: PACING, seed: () => seed++, results: onRecord }),
      () => {},
    );
    const session = rooms.create({ name: 'Moi', mode: 'solo', bots: 4 }, 's0');
    const room = rooms.store.get(session.code)!;
    const ids = [...room.members.keys()];
    const crafted = playing([[card(14)], [card(3)], [card(4), card(5)], [card(6)], [card(7)]]);
    room.game = {
      ...crafted,
      seats: crafted.seats.map((s, i) => ({ ...s, id: ids[i]! })),
      turn: ids[0]!,
    };
    return { rooms, room, human: room.members.get(ids[0]!)! };
  }

  it('enregistre le classement avec les rôles, une seule fois', () => {
    const records: RoundRecord[] = [];
    const { rooms, room, human } = nearEnd((r) => records.push(r));
    rooms.play(room, human, ['14-clubs']);
    for (let i = 0; i < 200 && room.game.phase !== 'roundOver'; i++) vi.advanceTimersByTime(1000);
    expect(room.game.phase).toBe('roundOver');
    vi.advanceTimersByTime(10_000);

    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record).toMatchObject({ v: 1, game: 'president', mode: 'solo', round: 1 });
    expect(record!.players.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(record!.players[0]).toMatchObject({
      name: 'Moi',
      bot: false,
      won: true,
      role: 'president',
    });
    expect(record!.players.at(-1)).toMatchObject({ bot: true, won: false, role: 'trouduc' });
    expect(record!.players.filter((p) => p.won)).toHaveLength(1);
  });

  it('ne compte pas un humain déconnecté (joué par le serveur)', () => {
    const records: RoundRecord[] = [];
    const { rooms, room, human } = nearEnd((r) => records.push(r));
    rooms.play(room, human, ['14-clubs']);
    // « Moi » se déconnecte ; un autre humain, connecté, garde la table en vie et joue lui-même.
    human.connected = false;
    const otherId = [...room.members.keys()][1]!;
    const other = room.members.get(otherId)!;
    other.isBot = false;
    other.connected = true;
    for (let i = 0; i < 200 && room.game.phase !== 'roundOver'; i++) {
      const game = room.game;
      if (game.phase === 'playing' && game.turn === otherId) {
        const hand = game.seats.find((s) => s.id === otherId)!.hand;
        try {
          rooms.play(room, other, [hand[0]!.id]);
        } catch {
          rooms.pass(room, other);
        }
      } else vi.advanceTimersByTime(1000);
    }
    expect(room.game.phase).toBe('roundOver');
    expect(records).toHaveLength(1);
    const names = records[0]!.players.map((p) => p.name);
    expect(names).not.toContain('Moi');
    expect(records[0]!.players.find((p) => !p.bot)?.name).toBe(other.name);
  });
});

describe('fileResultSink', () => {
  it('ajoute une ligne JSON par manche, dans l’ordre', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'president-')), 'results.jsonl');
    const sink = fileResultSink(file);
    for (const round of [1, 2, 3])
      sink({ v: 1, t: round, game: 'president', mode: 'online', round, players: [] });
    await new Promise((r) => setTimeout(r, 50));
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    expect(lines.map((l) => (JSON.parse(l) as RoundRecord).round)).toEqual([1, 2, 3]);
  });

  it('journalise une erreur d’écriture sans la propager', async () => {
    const log = vi.fn();
    const sink = fileResultSink('/dossier-absent/results.jsonl', log);
    expect(() =>
      sink({ v: 1, t: 1, game: 'president', mode: 'solo', round: 1, players: [] }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('non enregistré'));
  });
});
