import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@president/shared';
import { resolveOptions, type ServerOptions } from './config';
import { createHttpServer } from './http';
import { RoomService } from './rooms/RoomService';
import { bindTransport } from './transport';

export function createAppServer(overrides: Partial<ServerOptions> = {}) {
  const options = resolveOptions(overrides);
  const http = createHttpServer(options.staticDir);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: { origin: [...options.origins] },
    maxHttpBufferSize: 16_384,
    allowRequest: (req, callback) =>
      callback(null, !req.headers.origin || options.origins.includes(req.headers.origin)),
  });
  const rooms = new RoomService(options, (socketId, snapshot) =>
    io.to(socketId).emit('room:state', snapshot),
  );
  bindTransport(io, rooms);
  const sweep = setInterval(() => rooms.cleanup(), 60_000);
  sweep.unref();
  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise<void>((done) => {
        clearInterval(sweep);
        rooms.close();
        void io.close(() => done());
      }),
  };
}
