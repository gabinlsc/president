import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { createAppServer } from '../../apps/server/src/server';
import type { Reply, RoomSnapshot, Session } from '@president/shared';
import { card, playing } from '../game/helpers';

const clients: Socket[] = [];
const servers: ReturnType<typeof createAppServer>[] = [];
afterEach(async () => {
  clients.forEach((c) => c.disconnect());
  clients.length = 0;
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

const FAST = { dealDelay: 10, botDelay: 20, clearPause: 0 };

async function setup(options: Parameters<typeof createAppServer>[0] = {}) {
  const server = createAppServer({ pacing: FAST, staticDir: null, ...options });
  servers.push(server);
  await new Promise<void>((r) => server.http.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
  async function client(): Promise<Socket> {
    const s = io(url, { transports: ['websocket'], reconnection: false });
    clients.push(s);
    await new Promise<void>((r, j) => {
      s.on('connect', r);
      s.on('connect_error', j);
    });
    return s;
  }
  return { server, url, client };
}

function ack<T = Session>(s: Socket, event: string, data?: unknown): Promise<Reply<T>> {
  return new Promise((resolve, reject) => {
    s.timeout(2000).emit(
      event,
      ...(data === undefined ? [] : [data]),
      (err: Error | null, r: Reply<T>) => (err ? reject(err) : resolve(r)),
    );
  });
}
const ok = <T>(r: Reply<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

/** Resolves with the first snapshot matching `predicate`. */
function until(s: Socket, predicate: (v: RoomSnapshot) => boolean): Promise<RoomSnapshot> {
  return new Promise((resolve) => {
    const listener = (v: RoomSnapshot) => {
      if (!predicate(v)) return;
      s.off('room:state', listener);
      resolve(v);
    };
    s.on('room:state', listener);
  });
}

describe('HTTP', () => {
  it('sert le frontend et refuse les chemins inconnus ou sortant du répertoire public', async () => {
    const { url } = await setup({ staticDir: resolve('tests/fixtures') });
    const home = await fetch(url + '/');
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    expect(await home.text()).toContain('Table de jeu');
    expect((await fetch(url + '/missing.js')).status).toBe(404);
    expect((await fetch(url + '/..%2fpackage.json')).status).toBe(404);
  });

  it('health et routes inconnues respectent le contrat HTTP', async () => {
    const { url } = await setup();
    expect(await (await fetch(url + '/health')).json()).toEqual({ status: 'ok' });
    expect((await fetch(url + '/missing')).status).toBe(404);
  });
});

describe('Salons Socket.IO', () => {
  it('deux clients : mains privées, seul l’hôte démarre, distribution puis jeu', async () => {
    const { client } = await setup(),
      a = await client(),
      b = await client();
    const session = ok(await ack(a, 'room:create', { name: 'Alice', mode: 'online' }));
    expect(await ack(a, 'room:start')).toMatchObject({ ok: false });
    ok(await ack(b, 'room:join', { name: 'Bob', code: session.code.toLowerCase() }));
    expect(await ack(b, 'room:start')).toMatchObject({
      ok: false,
      error: expect.stringContaining('hôte'),
    });

    const dealtA = until(a, (v) => v.game.phase === 'dealing');
    const dealtB = until(b, (v) => v.game.phase === 'dealing');
    const playA = until(a, (v) => v.game.phase === 'playing');
    const playB = until(b, (v) => v.game.phase === 'playing');
    ok(await ack(a, 'room:start'));
    const [da, db] = await Promise.all([dealtA, dealtB]);
    expect(da.events).toEqual([{ type: 'dealt', round: 1 }]);
    expect(da.game.hand).toHaveLength(26);
    expect(db.game.hand).toHaveLength(26);
    expect(da.game.hand.some((c) => db.game.hand.some((d) => d.id === c.id))).toBe(false);
    for (const c of db.game.hand) expect(JSON.stringify(da)).not.toContain(`"${c.id}"`);
    expect(JSON.stringify(da)).not.toContain(session.token);

    const [va, vb] = await Promise.all([playA, playB]);
    const [mover, view] = va.game.turn === va.selfId ? [a, va] : [b, vb];
    expect(view.game.legalPlays).toContainEqual(['12-hearts']);
    expect(view.game.canPass).toBe(false);
    expect(await ack(mover, 'game:play', { cards: ['3-clubs', '4-clubs'] })).toMatchObject({
      ok: false,
    });
    ok(await ack(mover, 'game:play', { cards: ['12-hearts'] }));
    expect(await ack(mover, 'game:play', { cards: ['12-hearts'] })).toMatchObject({ ok: false });
    const late = await ack(await client(), 'room:join', { name: 'Late', code: session.code });
    expect(late).toMatchObject({ ok: false, error: 'Cette partie a déjà commencé.' });
  });

  it('reconnexion par jeton : même identité, jeton inconnu refusé', async () => {
    const { client } = await setup(),
      a = await client();
    const session = ok(await ack(a, 'room:create', { name: 'Alice', mode: 'online' }));
    a.disconnect();
    const b = await client();
    const view = until(b, () => true);
    expect(ok(await ack(b, 'session:resume', { token: session.token }))).toEqual(session);
    expect((await view).selfId).toBe(session.playerId);
    expect(await ack(await client(), 'session:resume', { token: 'f'.repeat(64) })).toMatchObject({
      ok: false,
    });
    expect(await ack(await client(), 'session:resume', { token: 'fake' })).toMatchObject({
      ok: false,
    });
  });

  it('une reprise évince l’ancienne socket et le départ révoque le jeton', async () => {
    const { client } = await setup(),
      a = await client();
    const session = ok(await ack(a, 'room:create', { name: 'Alice', mode: 'online' }));
    const kicked = new Promise<void>((r) => a.once('disconnect', () => r()));
    const b = await client();
    ok(await ack(b, 'session:resume', { token: session.token }));
    await kicked;
    ok(await ack(b, 'room:leave'));
    expect(await ack(await client(), 'session:resume', { token: session.token })).toMatchObject({
      ok: false,
    });
  });

  it('rejette les messages malformés sans arrêter le serveur', async () => {
    const { client } = await setup(),
      a = await client();
    for (const input of [
      null,
      42,
      { name: '', mode: 'online' },
      { name: 'X', mode: 'solo', bots: 3 },
      { name: 'X', mode: 'solo', bots: 8 },
      { name: 'X', mode: 'solo', bots: 4.5 },
    ])
      expect(await ack(a, 'room:create', input)).toMatchObject({ ok: false });
    expect(await ack(a, 'game:play', { cards: ['99-clubs'] })).toMatchObject({ ok: false });
    expect(await ack(a, 'game:pass')).toMatchObject({
      ok: false,
      error: 'Rejoignez un salon pour jouer.',
    });
    ok(await ack(a, 'room:create', { name: 'OK', mode: 'online' }));
  });

  it('refuse une connexion WebSocket provenant d’une origine non autorisée', async () => {
    const { url } = await setup();
    const s = io(url, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Origin: 'https://unknown.example' },
    });
    clients.push(s);
    await expect(
      new Promise<void>((resolve, reject) => {
        s.once('connect', resolve);
        s.once('connect_error', reject);
      }),
    ).rejects.toThrow();
  });

  it('un joueur déconnecté est joué par un bot puis récupère sa main', async () => {
    const { client, server } = await setup(),
      a = await client(),
      b = await client();
    const sa = ok(await ack(a, 'room:create', { name: 'A', mode: 'online' }));
    const sb = ok(await ack(b, 'room:join', { code: sa.code, name: 'B' }));
    const started = until(a, (v) => v.game.phase === 'playing');
    ok(await ack(a, 'room:start'));
    await started;
    const room = server.rooms.store.get(sa.code)!;
    const crafted = playing(
      [
        [card(9), card(10)],
        [card(3), card(4)],
      ],
      { turn: sb.playerId },
    );
    room.game = {
      ...crafted,
      seats: crafted.seats.map((s, i) => ({ ...s, id: [sa.playerId, sb.playerId][i]! })),
    };
    const played = until(a, (v) => v.game.seats.find((s) => s.id === sb.playerId)?.cardCount === 1);
    b.disconnect();
    await played;
    const recovered = await client();
    const view = until(recovered, () => true);
    ok(await ack(recovered, 'session:resume', { token: sb.token }));
    expect((await view).game.hand).toHaveLength(1);
  });

  it('une partie solo se lance seule et les bots jouent jusqu’au tour de l’humain', async () => {
    const { client } = await setup(),
      a = await client();
    const humanTurn = until(a, (v) => v.game.phase === 'playing' && v.game.turn === v.selfId);
    const session = ok(await ack(a, 'room:create', { name: 'Moi', mode: 'solo', bots: 4 }));
    const view = await humanTurn;
    expect(view.selfId).toBe(session.playerId);
    expect(view.members.filter((m) => m.isBot)).toHaveLength(4);
    expect(view.game.legalPlays.length).toBeGreaterThan(0);
  });
});
