import type { Server, Socket } from 'socket.io';
import {
  cardsSchema,
  createRoomSchema,
  InputError,
  joinRoomSchema,
  parseInput,
  resumeSchema,
  type ClientToServerEvents,
  type Reply,
  type ServerToClientEvents,
} from '@president/shared';
import { RoomError, type RoomService } from './rooms/RoomService';

const RATE_WINDOW = 10_000;
const RATE_LIMIT = 40;

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Binds the Socket.IO protocol to the room service. Inputs are untrusted until parsed. */
export function bindTransport(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  rooms: RoomService,
): void {
  io.on('connection', (socket: GameSocket) => {
    let token: string | null = null;
    let windowStart = Date.now();
    let requests = 0;

    const handle = <T>(ack: unknown, operation: () => T): void => {
      if (typeof ack !== 'function') return;
      let reply: Reply<T>;
      try {
        if (Date.now() - windowStart > RATE_WINDOW) {
          windowStart = Date.now();
          requests = 0;
        }
        if (++requests > RATE_LIMIT)
          throw new RoomError('Trop de demandes. Patientez quelques secondes.');
        reply = { ok: true, data: operation() };
      } catch (error) {
        const expected = error instanceof RoomError || error instanceof InputError;
        if (!expected) console.error(error);
        reply = { ok: false, error: expected ? error.message : 'Erreur interne du serveur.' };
      }
      (ack as (reply: Reply<T>) => void)(reply);
    };
    const withoutSession = (): void => {
      if (token) throw new RoomError('Quittez votre salon avant d’en rejoindre un autre.');
    };
    const context = () => rooms.authenticate(token, socket.id);

    socket.on('room:create', (input: unknown, ack: unknown) =>
      handle(ack, () => {
        withoutSession();
        const session = rooms.create(parseInput(createRoomSchema, input), socket.id);
        token = session.token;
        return session;
      }),
    );
    socket.on('room:join', (input: unknown, ack: unknown) =>
      handle(ack, () => {
        withoutSession();
        const session = rooms.join(parseInput(joinRoomSchema, input), socket.id);
        token = session.token;
        return session;
      }),
    );
    socket.on('session:resume', (input: unknown, ack: unknown) =>
      handle(ack, () => {
        withoutSession();
        const { session, previousSocket } = rooms.resume(
          parseInput(resumeSchema, input).token,
          socket.id,
        );
        token = session.token;
        if (previousSocket && previousSocket !== socket.id)
          io.sockets.sockets.get(previousSocket)?.disconnect(true);
        return session;
      }),
    );
    socket.on('room:start', (ack: unknown) =>
      handle(ack, () => {
        const { room, member } = context();
        rooms.start(room, member);
        return null;
      }),
    );
    socket.on('game:next', (ack: unknown) =>
      handle(ack, () => {
        const { room, member } = context();
        rooms.nextRound(room, member);
        return null;
      }),
    );
    socket.on('game:play', (input: unknown, ack: unknown) =>
      handle(ack, () => {
        const { cards } = parseInput(cardsSchema, input);
        const { room, member } = context();
        rooms.play(room, member, cards);
        return null;
      }),
    );
    socket.on('game:pass', (ack: unknown) =>
      handle(ack, () => {
        const { room, member } = context();
        rooms.pass(room, member);
        return null;
      }),
    );
    socket.on('game:exchange', (input: unknown, ack: unknown) =>
      handle(ack, () => {
        const { cards } = parseInput(cardsSchema, input);
        const { room, member } = context();
        rooms.exchange(room, member, cards);
        return null;
      }),
    );
    socket.on('room:leave', (ack: unknown) =>
      handle(ack, () => {
        const { room, member } = context();
        rooms.leave(room, member);
        token = null;
        return null;
      }),
    );
    socket.on('disconnect', () => {
      if (!token) return;
      try {
        const { room, member } = context();
        rooms.disconnect(room, member);
      } catch {
        // The session was taken over by another socket or already revoked.
      }
    });
  });
}
