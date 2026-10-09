import { createServer as createHttpServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { Server } from 'socket.io';
import type { ClientEvents, ServerEvents, Reply } from '@president/shared';
import { RoomManager } from './RoomManager';
import { BotScheduler } from './BotScheduler';

export function createAppServer(
  options: { origin?: string; staticDir?: string; botDelay?: number } = {},
) {
  const rooms = new RoomManager();
  const origins = (
    options.origin ??
    process.env.CLIENT_ORIGIN ??
    'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((s) => s.trim());
  const http = createHttpServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (options.staticDir && req.method === 'GET') {
      try {
        const root = resolve(options.staticDir),
          pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
        let file = resolve(root, `.${pathname}`);
        if (!file.startsWith(root + '\\') && !file.startsWith(root + '/') && file !== root)
          throw new Error('Path');
        if (pathname === '/') file = resolve(root, 'index.html');
        if (!(await stat(file).catch(() => null))?.isFile()) throw new Error('Not found');
        const mime: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.ico': 'image/x-icon',
          '.woff2': 'font/woff2',
        };
        const content = await readFile(file);
        res.writeHead(200, {
          'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': file.includes('assets')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        });
        res.end(content);
        return;
      } catch {
        /* return 404 */
      }
    }
    res.writeHead(404);
    res.end('Not found');
  });
  const io = new Server<ClientEvents, ServerEvents>(http, {
    cors: { origin: origins },
    maxHttpBufferSize: 16_384,
    allowRequest: (req, cb) =>
      cb(null, !req.headers.origin || origins.includes(req.headers.origin)),
  });
  const bots = new BotScheduler(
    rooms,
    options.botDelay ?? Math.max(20, Number(process.env.BOT_DELAY ?? 850)),
  );
  rooms.onChange = (room) => {
    for (const member of room.members)
      if (member.socketId) io.to(member.socketId).emit('room:state', rooms.view(room, member.id));
    bots.schedule(room);
  };
  io.on('connection', (socket) => {
    let token: string | null = null,
      windowStart = Date.now(),
      requests = 0;
    const action = <T>(ack: unknown, operation: () => T) => {
      if (typeof ack !== 'function') return;
      let reply: Reply<T>;
      try {
        if (Date.now() - windowStart > 10_000) {
          windowStart = Date.now();
          requests = 0;
        }
        if (++requests > 40) throw new Error('Trop de demandes. Patientez quelques secondes.');
        reply = { ok: true, data: operation() };
      } catch (e) {
        reply = { ok: false, error: e instanceof Error ? e.message : 'Demande invalide.' };
      }
      (ack as (r: Reply<T>) => void)(reply);
    };
    const noSession = () => {
      if (token) throw new Error('Quittez votre salon avant d’en rejoindre un autre.');
    };
    socket.on('room:create', (input, ack) =>
      action(ack, () => {
        noSession();
        const s = rooms.create(input, socket.id);
        token = s.token;
        return s;
      }),
    );
    socket.on('room:join', (input, ack) =>
      action(ack, () => {
        noSession();
        const s = rooms.join(input, socket.id);
        token = s.token;
        return s;
      }),
    );
    socket.on('session:resume', (input, ack) =>
      action(ack, () => {
        noSession();
        const result = rooms.resume(input?.token, socket.id);
        token = result.session.token;
        if (result.previousSocket && result.previousSocket !== socket.id)
          io.sockets.sockets.get(result.previousSocket)?.disconnect(true);
        return result.session;
      }),
    );
    socket.on('room:start', (ack) =>
      action(ack, () => {
        const { room, member } = rooms.requireMember(token, socket.id);
        rooms.start(room, member.id);
      }),
    );
    socket.on('game:next', (ack) =>
      action(ack, () => {
        const { room, member } = rooms.requireMember(token, socket.id);
        rooms.next(room, member.id);
      }),
    );
    socket.on('game:play', (input, ack) =>
      action(ack, () => {
        const { room, member } = rooms.requireMember(token, socket.id);
        rooms.requireGame(room).play(member.id, input?.cards);
        rooms.changed(room);
      }),
    );
    socket.on('game:pass', (ack) =>
      action(ack, () => {
        const { room, member } = rooms.requireMember(token, socket.id);
        rooms.requireGame(room).pass(member.id);
        rooms.changed(room);
      }),
    );
    socket.on('game:exchange', (input, ack) =>
      action(ack, () => {
        const { room, member } = rooms.requireMember(token, socket.id);
        rooms.requireGame(room).exchange(member.id, input?.cards);
        rooms.changed(room);
      }),
    );
    socket.on('room:leave', (ack) =>
      action(ack, () => {
        rooms.disconnect(token, socket.id, true);
        token = null;
      }),
    );
    socket.on('disconnect', () => rooms.disconnect(token, socket.id));
  });
  const cleanup = setInterval(() => rooms.cleanup(), 60_000);
  cleanup.unref();
  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise<void>((done) => {
        clearInterval(cleanup);
        bots.close();
        io.close(() => done());
      }),
  };
}
