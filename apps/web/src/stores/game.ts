import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type {
  Card,
  CardId,
  CreateRoomInput,
  GameEvent,
  JoinRoomInput,
  Play,
  PlayerId,
  RoomSnapshot,
  TrickClearReason,
} from '@president/shared';
import { call, socket } from '../lib/socket';
import { storage } from '../lib/storage';
import { describeEvent } from '../lib/describe';

/** How long a cleared trick stays visible before sweeping away. */
export const CLEAR_DISPLAY_MS = 950;
const NOTICE_MS = 3000;
const LOG_SIZE = 14;

export interface ClearedTrick {
  readonly id: number;
  readonly plays: readonly Play[];
  readonly reason: TrickClearReason;
  /** Who takes the lead: the cleared pile slides towards them. */
  readonly leaderId: PlayerId | null;
}

/** What a seat just did, shown briefly next to it so every move is attributed. */
export interface SeatAction {
  readonly id: number;
  readonly kind: 'play' | 'cut' | 'pass' | 'out';
  readonly cards: readonly Card[];
}
export const SEAT_ACTION_MS = 1800;

export interface LogLine {
  readonly id: number;
  readonly text: string;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * Mirror of the server state. The store never decides whether a move is legal: it only matches
 * the selection against `legalPlays` computed by the server.
 */
export const useGameStore = defineStore('game', () => {
  const snapshot = shallowRef<RoomSnapshot | null>(null);
  const connected = ref(false);
  const pending = ref(false);
  const error = ref('');
  const notice = ref('');
  const selected = ref<CardId[]>([]);
  const cleared = shallowRef<ClearedTrick | null>(null);
  const log = ref<LogLine[]>([]);
  let sequence = 0;
  const seatActions = ref<Record<PlayerId, SeatAction>>({});
  const seatTimers = new Map<PlayerId, ReturnType<typeof setTimeout>>();
  let clearTimer: ReturnType<typeof setTimeout> | undefined;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  const game = computed(() => snapshot.value?.game ?? null);
  const selfId = computed(() => snapshot.value?.selfId ?? null);
  const self = computed(() => game.value?.seats.find((s) => s.id === selfId.value) ?? null);
  const isHost = computed(
    () => !!snapshot.value && snapshot.value.hostId === snapshot.value.selfId,
  );
  const isMyTurn = computed(
    () => !!game.value && game.value.phase === 'playing' && game.value.turn === selfId.value,
  );
  const nameOf = (id: PlayerId | null): string =>
    snapshot.value?.members.find((m) => m.id === id)?.name ?? '';

  const selectedMove = computed(
    () => game.value?.legalPlays.find((ids) => sameSet(ids, selected.value)) ?? null,
  );
  const canPlay = computed(() => game.value?.phase === 'playing' && selectedMove.value !== null);
  /** Any legal play while it is not our turn is, by construction, a square cut. */
  const isCut = computed(() => canPlay.value && !isMyTurn.value);
  const canPass = computed(() => !!game.value?.canPass);
  /** A square the server lets us close right now, on our turn or out of turn. */
  const availableCut = computed(() => game.value?.squarePlays[0] ?? null);
  const canExchange = computed(() => {
    const exchange = game.value?.exchange;
    return (
      game.value?.phase === 'exchanging' &&
      !!exchange &&
      !exchange.forced &&
      !exchange.submitted &&
      selected.value.length === exchange.give
    );
  });

  function toast(message: string): void {
    notice.value = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice.value = ''), NOTICE_MS);
  }

  function record(events: readonly GameEvent[], next: RoomSnapshot): void {
    const name = (id: PlayerId) => next.members.find((m) => m.id === id)?.name ?? '?';
    const lines = events.map((e) => describeEvent(e, name)).filter((t): t is string => t !== null);
    if (lines.length)
      log.value = [...log.value, ...lines.map((text) => ({ id: ++sequence, text }))].slice(
        -LOG_SIZE,
      );
  }

  function receive(next: RoomSnapshot): void {
    const previous = snapshot.value;
    // Socket.IO keeps order on one connection; the version guards against a stale replay.
    if (previous && previous.code === next.code && next.version <= previous.version) return;
    if (previous?.code !== next.code) log.value = [];
    record(next.events, next);
    for (const event of next.events) {
      if (event.type === 'played')
        flash(event.playerId, { kind: event.outOfTurn ? 'cut' : 'play', cards: event.cards });
      else if (event.type === 'passed') flash(event.playerId, { kind: 'pass', cards: [] });
      else if (event.type === 'playerFinished') flash(event.playerId, { kind: 'out', cards: [] });
    }
    const clear = next.events.find((e) => e.type === 'trickCleared');
    if (clear?.type === 'trickCleared') {
      cleared.value = {
        id: ++sequence,
        plays: clear.plays,
        reason: clear.reason,
        leaderId: clear.leaderId,
      };
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => (cleared.value = null), CLEAR_DISPLAY_MS);
    } else if (next.game.trick) cleared.value = null;
    if (next.events.some((e) => e.type === 'dealt') || next.game.phase !== previous?.game.phase)
      selected.value = [];
    selected.value = selected.value.filter((id) => next.game.hand.some((c) => c.id === id));
    snapshot.value = next;
  }

  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (pending.value) return undefined;
    if (!connected.value) {
      error.value = 'Connexion interrompue. La reconnexion est automatique.';
      return undefined;
    }
    pending.value = true;
    error.value = '';
    try {
      return await operation();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Le serveur ne répond pas. Réessayez.';
      return undefined;
    } finally {
      pending.value = false;
    }
  }

  async function enter(request: () => Promise<{ token: string }>, name: string): Promise<boolean> {
    const session = await run(request);
    if (!session) return false;
    storage.setToken(session.token);
    storage.setName(name.trim());
    return true;
  }

  const create = (input: CreateRoomInput) => enter(() => call('room:create', input), input.name);
  const join = (input: JoinRoomInput) => enter(() => call('room:join', input), input.name);
  const start = () => run(() => call('room:start'));
  const nextRound = () => run(() => call('game:next'));
  const pass = () => run(() => call('game:pass'));

  /** Lays the square the server offers, in one click. */
  async function cut(): Promise<void> {
    const cards = availableCut.value;
    if (!cards) return;
    const done = await run(() => call('game:play', { cards: [...cards] }));
    if (done !== undefined) selected.value = [];
  }

  function flash(playerId: PlayerId, action: Omit<SeatAction, 'id'>): void {
    const previous = seatActions.value[playerId];
    // A finish keeps the cards of the play that led to it visible.
    const cards = action.kind === 'out' && previous ? previous.cards : action.cards;
    seatActions.value = { ...seatActions.value, [playerId]: { ...action, cards, id: ++sequence } };
    clearTimeout(seatTimers.get(playerId));
    seatTimers.set(
      playerId,
      setTimeout(() => {
        const rest = { ...seatActions.value };
        delete rest[playerId];
        seatActions.value = rest;
      }, SEAT_ACTION_MS),
    );
  }

  async function play(): Promise<void> {
    const move = selectedMove.value;
    if (!move) return;
    const done = await run(() => call('game:play', { cards: move }));
    if (done !== undefined) selected.value = [];
  }

  async function exchange(): Promise<void> {
    const cards = [...selected.value];
    const done = await run(() => call('game:exchange', { cards }));
    if (done !== undefined) selected.value = [];
  }

  async function leave(): Promise<boolean> {
    const done = await run(() => call('room:leave'));
    if (done === undefined) return false;
    storage.setToken(null);
    snapshot.value = null;
    selected.value = [];
    log.value = [];
    return true;
  }

  function toggle(id: CardId): void {
    selected.value = selected.value.includes(id)
      ? selected.value.filter((x) => x !== id)
      : [...selected.value, id];
  }

  function connect(): void {
    socket.on('room:state', receive);
    socket.on('connect', async () => {
      connected.value = true;
      error.value = '';
      const token = storage.token();
      if (!token) return;
      pending.value = true;
      try {
        await call('session:resume', { token });
      } catch (e) {
        storage.setToken(null);
        snapshot.value = null;
        error.value = e instanceof Error ? e.message : 'Session expirée.';
      } finally {
        pending.value = false;
      }
    });
    socket.on('disconnect', () => (connected.value = false));
    socket.on('connect_error', () => (connected.value = false));
    socket.connect();
  }

  return {
    snapshot,
    game,
    connected,
    pending,
    error,
    notice,
    selected,
    cleared,
    seatActions,
    availableCut,
    cut,
    log,
    selfId,
    self,
    isHost,
    isMyTurn,
    selectedMove,
    canPlay,
    isCut,
    canPass,
    canExchange,
    nameOf,
    toast,
    toggle,
    connect,
    create,
    join,
    start,
    nextRound,
    play,
    pass,
    exchange,
    leave,
  };
});
