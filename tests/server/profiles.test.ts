import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createIdentify } from '../../apps/server/src/profiles';
import { createAppServer } from '../../apps/server/src/server';

const PID = '0123456789abcdef';
const FAST = { dealDelay: 0, botDelay: 0, clearPause: 0 };

/** Stand-in for the profiles service: cookie "glsc_sid=GOOD…" is Gabin; the pseudo "gabin" is reserved. */
function fakeProfiles(respond?: () => unknown) {
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const body = JSON.parse(raw) as { cookie: string; name: string };
      const out =
        respond?.() ??
        (body.cookie.includes('glsc_sid=GOOD')
          ? { pid: PID, name: 'Gabin' }
          : { pid: null, guestNameOk: body.name.toLowerCase() !== 'gabin' });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    });
  });
  return new Promise<{ url: string; close: () => void }>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        close: () => server.close(),
      }),
    ),
  );
}

describe('createIdentify', () => {
  it('reconnaît un profil, dit si le pseudo d’un invité est libre, et retombe sur « invité » en cas de souci', async () => {
    const svc = await fakeProfiles();
    const identify = createIdentify(svc.url);
    expect(await identify('glsc_sid=GOOD1', 'Mallory')).toEqual({
      pid: PID,
      name: 'Gabin',
      guestNameOk: true,
    });
    expect(await identify(undefined, 'GABIN')).toEqual({
      pid: null,
      name: null,
      guestNameOk: false,
    });
    expect(await identify('x=1', 'Léa')).toEqual({ pid: null, name: null, guestNameOk: true });
    svc.close();
    const guest = { pid: null, name: null, guestNameOk: true };
    expect(await createIdentify(undefined)('glsc_sid=GOOD1', 'Gabin')).toEqual(guest);
    expect(await createIdentify('http://127.0.0.1:1')('glsc_sid=GOOD1', 'Gabin')).toEqual(guest);
    const slow = await fakeProfiles(() => new Promise(() => undefined));
    expect(await createIdentify(slow.url, 100)('glsc_sid=GOOD1', 'Gabin')).toEqual(guest);
    slow.close();
    const garbled = await fakeProfiles(() => ({ pid: 'zz', name: 'x' }));
    expect(await createIdentify(garbled.url)('glsc_sid=GOOD1', 'Gabin')).toEqual(guest);
    garbled.close();
  });
});

let app: ReturnType<typeof createAppServer>;
let svc: Awaited<ReturnType<typeof fakeProfiles>>;
let url: string;
const sockets: Socket[] = [];

beforeEach(async () => {
  svc = await fakeProfiles();
  app = createAppServer({ pacing: FAST, staticDir: null, identify: createIdentify(svc.url) });
  await new Promise<void>((r) => app.http.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
});
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await app.close();
  svc.close();
});

async function connect(cookie?: string): Promise<Socket> {
  const s = io(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...(cookie ? { extraHeaders: { cookie } } : {}),
  });
  sockets.push(s);
  await new Promise<void>((r, j) => {
    s.once('connect', () => r());
    s.once('connect_error', j);
  });
  return s;
}
const call = (s: Socket, event: string, payload: unknown) =>
  new Promise<{ ok: boolean; data?: { code: string }; error?: string }>((resolve) =>
    s.emit(event, payload, resolve),
  );

describe('profils sur Socket.IO', () => {
  it('un joueur connecté joue sous le pseudo de son profil, quoi que le client envoie', async () => {
    const s = await connect('glsc_sid=GOOD1');
    const created = await call(s, 'room:create', { mode: 'online', name: 'Mallory' });
    expect(created.ok).toBe(true);
    const code = created.data?.code ?? '';
    const room = app.rooms.store.get(code);
    expect([...(room?.members.values() ?? [])].map((m) => ({ name: m.name, pid: m.pid }))).toEqual([
      { name: 'Gabin', pid: PID },
    ]);
  });

  it('un invité ne peut pas prendre un pseudo réservé, ni pour créer ni pour rejoindre', async () => {
    const host = await connect('glsc_sid=GOOD1');
    const room = await call(host, 'room:create', { mode: 'online', name: 'x' });
    const guest = await connect();
    const refused = await call(guest, 'room:create', { mode: 'online', name: 'gabin' });
    expect(refused).toMatchObject({
      ok: false,
      error: expect.stringContaining('appartient à un profil'),
    });
    const join = await call(guest, 'room:join', { code: room.data?.code, name: 'GABIN' });
    expect(join.ok).toBe(false);
    expect((await call(guest, 'room:join', { code: room.data?.code, name: 'Léa' })).ok).toBe(true);
  });

  it('deux demandes simultanées sur la même connexion ne créent qu’un seul salon', async () => {
    const s = await connect('glsc_sid=GOOD1');
    const [a, b] = await Promise.all([
      call(s, 'room:create', { mode: 'online', name: 'x' }),
      call(s, 'room:create', { mode: 'online', name: 'x' }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(app.rooms.store.size).toBe(1);
  });
});
