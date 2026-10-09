import { ref, computed } from 'vue';
import { io } from 'socket.io-client';
import type { RoomView, Reply, Session, ClientEvents } from '@president/shared';

const socket = io(import.meta.env.VITE_SERVER_URL || undefined, { autoConnect: true });
const room = ref<RoomView | null>(null),
  connected = ref(false),
  pending = ref(false),
  error = ref(''),
  notice = ref('');
let noticeTimer: ReturnType<typeof setTimeout>;
const readToken = () => {
  try {
    return sessionStorage.getItem('president-token');
  } catch {
    return null;
  }
};
const saveToken = (token: string | null) => {
  try {
    token
      ? sessionStorage.setItem('president-token', token)
      : sessionStorage.removeItem('president-token');
  } catch {
    /* memory session remains usable */
  }
};
async function request(event: keyof ClientEvents, input?: unknown): Promise<Session | undefined> {
  const result = (await socket
    .timeout(7000)
    .emitWithAck(event, ...(input === undefined ? [] : [input]))) as Reply<Session | undefined>;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
socket.on('room:state', (state: RoomView) => {
  room.value = state;
});
socket.on('connect', async () => {
  connected.value = true;
  error.value = '';
  const token = readToken();
  if (!token) return;
  pending.value = true;
  try {
    await request('session:resume', { token });
  } catch (e) {
    saveToken(null);
    room.value = null;
    error.value = e instanceof Error ? e.message : 'Session expirée.';
  } finally {
    pending.value = false;
  }
});
socket.on('disconnect', () => {
  connected.value = false;
});
socket.on('connect_error', () => {
  connected.value = false;
});
export function useGame() {
  const self = computed(() => room.value?.players.find((p) => p.id === room.value?.selfId));
  const isHost = computed(() => room.value?.hostId === room.value?.selfId);
  const isTurn = computed(() => room.value?.turn === room.value?.selfId);
  const toast = (message: string) => {
    notice.value = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice.value = ''), 3000);
  };
  async function command(event: keyof ClientEvents, input?: unknown): Promise<boolean> {
    if (pending.value) return false;
    if (!connected.value) {
      error.value = 'Connexion interrompue. La reconnexion est automatique.';
      return false;
    }
    pending.value = true;
    error.value = '';
    try {
      const session = await request(event, input);
      if (session) saveToken(session.token);
      if (event === 'room:leave') {
        saveToken(null);
        room.value = null;
      }
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Le serveur ne répond pas. Réessayez.';
      return false;
    } finally {
      pending.value = false;
    }
  }
  return { room, connected, pending, error, notice, self, isHost, isTurn, command, toast };
}
