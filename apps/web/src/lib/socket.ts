import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, Reply, ServerToClientEvents } from '@president/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type EventName = keyof ClientToServerEvents;
type Args<E extends EventName> = Parameters<ClientToServerEvents[E]>;
/** Payload arguments of an event, without its trailing acknowledgement callback. */
export type Payload<E extends EventName> = Args<E> extends [infer Input, Ack<never>] ? [Input] : [];
export type AckData<E extends EventName> = Args<E> extends [...unknown[], Ack<infer T>] ? T : never;

const REQUEST_TIMEOUT = 7000;

export const socket: GameSocket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
});

/** Emits a request and resolves with its data, or rejects with the server's message. */
export async function call<E extends EventName>(
  event: E,
  ...payload: Payload<E>
): Promise<AckData<E>> {
  const emitter = socket.timeout(REQUEST_TIMEOUT) as unknown as {
    emitWithAck(event: E, ...args: unknown[]): Promise<Reply<AckData<E>>>;
  };
  let reply: Reply<AckData<E>>;
  try {
    reply = await emitter.emitWithAck(event, ...payload);
  } catch {
    throw new Error('Le serveur ne répond pas. Réessayez.');
  }
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
