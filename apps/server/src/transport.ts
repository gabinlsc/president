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
import type { Identify } from './profiles';
import { RoomError, type RoomService } from './rooms/RoomService';

const RATE_WINDOW = 10_000;
const RATE_LIMIT = 40;

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Binds the Socket.IO protocol to the room service. Inputs are untrusted until parsed. */
export function bindTransport(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  rooms: RoomService,
  identify: Identify,
): void {
  io.on('connection', (socket: GameSocket) => {
    let token: string | null = null;
    let windowStart = Date.now();
    let requests = 0;

    const handle = <T>(ack: unknown, operation: () => T | Promise<T>): void => {
      if (typeof ack !== 'function') return;
      const send = (reply: Reply<T>): void => (ack as (reply: Reply<T>) => void)(reply);
      const fail = (error: unknown): void => {
        const expected = error instanceof RoomError || error instanceof InputError;
        if (!expected) console.error(error);
        send({
          ok: false,
          error: expected ? (error as Error).message : 'Erreur interne du serveur.',
        });
      };
      try {
        if (Date.now() - windowStart > RATE_WINDOW) {
          windowStart = Date.now();
          requests = 0;
        }
        if (++requests > RATE_LIMIT)
          throw new RoomError('Trop de demandes. Patientez quelques secondes.');
        const out = operation();
        if (out instanceof Promise) out.then((data) => send({ ok: true, data }), fail);
        else send({ ok: true, data: out });
      } catch (error) {
        fail(error);
      }
    };
    /** Signed-in players play under their profile pseudo; guests cannot take a pseudo reserved by a profile. */
    let identifying = false;
    const withIdentity = async <T>(
      typed: string,
      use: (name: string, pid: string | undefined) => T,
    ): Promise<T> => {
      if (identifying) throw new RoomError('Patientez un instant.');
      identifying = true;
      try {
        const id = await identify(socket.handshake.headers.cookie, typed);
        withoutSession(); // the socket may have joined a room while we were waiting
        if (id.pid && id.name) return use(id.name, id.pid);
        if (!id.guestNameOk)
          throw new RoomError(
            'Ce pseudo appartient à un profil : connectez-vous (Mon profil) ou choisissez-en un autre.',
          );
        return use(typed, undefined);
      } finally {
        identifying = false;
      }
    };
    const withoutSession = (): void => {
      if (token) throw new RoomError('Quittez votre salon avant d’en rejoindre un autre.');
    };
    const context = () => rooms.authenticate(token, socket.id);

    socket.on('room:create', (input: unknown, ack: unknown) =>
      handle(ack, () => {
        withoutSession();
        const parsed = parseInput(createRoomSchema, input);
        return withIdentity(parsed.name, (name, pid) => {
          const session = rooms.create({ ...parsed, name }, socket.id, pid);
          token = session.token;
          return session;
        });
      }),
    );
    socket.on('room:join', (input: unknown, ack: unknown) =>
      handle(ack, () => {
        withoutSession();
        const parsed = parseInput(joinRoomSchema, input);
        return withIdentity(parsed.name, (name, pid) => {
          const session = rooms.join({ ...parsed, name }, socket.id, pid);
          token = session.token;
          return session;
        });
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
