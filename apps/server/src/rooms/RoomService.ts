import { randomBytes, randomUUID } from 'node:crypto';
import { chooseBotAction, createGame, legalPlays, toGameView, transition } from '@president/game';
import type {
  CardId,
  CreateRoomInput,
  GameAction,
  GameEvent,
  JoinRoomInput,
  PlayerId,
  RoomSnapshot,
  Session,
} from '@president/shared';
import type { ServerOptions } from '../config';
import { hasConnectedHuman, isAutomated, type Member, type Room } from './Room';
import { RoomStore } from './RoomStore';

export const MAX_ROOMS = 1000;
const BOT_NAMES = ['Camille', 'Sacha', 'Lou', 'Noa', 'Charlie', 'Alex', 'Robin', 'Jules'] as const;

/** Error whose message is safe to show to the player. */
export class RoomError extends Error {}

export type Publish = (socketId: string, snapshot: RoomSnapshot) => void;

interface Scheduled {
  readonly action: GameAction;
  readonly delay: number;
}

/**
 * The single source of truth: every change to a room goes through this service, is validated by
 * the game reducer, then pushed to each member as its own filtered snapshot.
 */
export class RoomService {
  readonly store = new RoomStore();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly options: ServerOptions,
    private readonly publish: Publish,
  ) {}

  create(input: CreateRoomInput, socketId: string): Session {
    if (this.store.size >= MAX_ROOMS)
      throw new RoomError('Le serveur est complet. Réessayez plus tard.');
    const human = this.human(input.name, socketId);
    const room: Room = {
      code: this.freeCode(),
      mode: input.mode,
      hostId: human.id,
      members: new Map([[human.id, human]]),
      game: createGame(),
      version: 0,
      lastEvents: [],
      touchedAt: Date.now(),
    };
    this.apply(room, { type: 'seat', playerId: human.id, name: human.name });
    if (input.mode === 'solo') {
      for (const name of BOT_NAMES.slice(0, input.bots ?? 0)) {
        const bot: Member = {
          id: randomUUID(),
          name,
          isBot: true,
          connected: false,
          autoCut: false,
          socketId: null,
          token: null,
        };
        room.members.set(bot.id, bot);
        this.apply(room, { type: 'seat', playerId: bot.id, name });
      }
      this.apply(room, { type: 'start', seed: this.options.seed() });
    }
    this.store.add(room);
    this.commit(room, room.lastEvents);
    return this.session(room, human);
  }

  join(input: JoinRoomInput, socketId: string): Session {
    const room = this.store.get(input.code);
    if (!room || room.mode !== 'online') throw new RoomError('Ce salon est introuvable.');
    if (room.game.phase !== 'lobby') throw new RoomError('Cette partie a déjà commencé.');
    const human = this.human(input.name, socketId);
    this.apply(room, { type: 'seat', playerId: human.id, name: human.name });
    room.members.set(human.id, human);
    this.store.index(room, human);
    this.commit(room, []);
    return this.session(room, human);
  }

  /** Re-attaches a token to a new socket; returns the socket it replaces, if any. */
  resume(token: string, socketId: string): { session: Session; previousSocket: string | null } {
    const found = this.store.resolve(token);
    if (!found) throw new RoomError('La session a expiré.');
    const { room, member } = found;
    const previousSocket = member.socketId;
    member.socketId = socketId;
    member.connected = true;
    if (!room.members.get(room.hostId)?.connected) room.hostId = member.id;
    this.commit(room, []);
    return { session: this.session(room, member), previousSocket };
  }

  /** Identity always comes from the server-side session bound to this socket. */
  authenticate(token: string | null, socketId: string): { room: Room; member: Member } {
    const found = token ? this.store.resolve(token) : null;
    if (!found || found.member.socketId !== socketId)
      throw new RoomError('Rejoignez un salon pour jouer.');
    return found;
  }

  start(room: Room, member: Member): void {
    this.requireHost(room, member, 'Seul l’hôte peut lancer la partie.');
    this.dispatch(room, { type: 'start', seed: this.options.seed() });
  }

  nextRound(room: Room, member: Member): void {
    this.requireHost(room, member, 'Seul l’hôte peut lancer la manche suivante.');
    this.dispatch(room, { type: 'nextRound', seed: this.options.seed() });
  }

  play(room: Room, member: Member, cards: readonly CardId[]): void {
    this.dispatch(room, { type: 'play', playerId: member.id, cards });
  }

  pass(room: Room, member: Member): void {
    this.dispatch(room, { type: 'pass', playerId: member.id });
  }

  exchange(room: Room, member: Member, cards: readonly CardId[]): void {
    this.dispatch(room, { type: 'exchange', playerId: member.id, cards });
  }

  setAutoCut(room: Room, member: Member, enabled: boolean): void {
    member.autoCut = enabled;
    this.commit(room, []);
  }

  /** Explicit departure: the token is revoked; mid-game the seat is handed to a bot. */
  leave(room: Room, member: Member): void {
    this.store.revoke(member);
    member.connected = false;
    member.socketId = null;
    if (room.game.phase === 'lobby') {
      this.apply(room, { type: 'unseat', playerId: member.id });
      room.members.delete(member.id);
    } else member.isBot = true;
    if (![...room.members.values()].some((m) => !m.isBot)) {
      this.remove(room);
      return;
    }
    this.reassignHost(room);
    this.commit(room, []);
  }

  /** Transport loss: the seat is kept and played automatically until the player resumes. */
  disconnect(room: Room, member: Member): void {
    member.connected = false;
    member.socketId = null;
    this.reassignHost(room);
    this.commit(room, []);
  }

  cleanup(now = Date.now()): void {
    for (const room of [...this.store.values()])
      if (!hasConnectedHuman(room) && now - room.touchedAt >= this.options.roomTtl)
        this.remove(room);
  }

  close(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  snapshot(room: Room, selfId: PlayerId): RoomSnapshot {
    const seatOrder = room.game.seats.map((s) => s.id);
    const members = [...room.members.values()].sort(
      (a, b) => seatOrder.indexOf(a.id) - seatOrder.indexOf(b.id),
    );
    return {
      code: room.code,
      mode: room.mode,
      hostId: room.hostId,
      selfId,
      autoCut: room.members.get(selfId)?.autoCut ?? false,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        isBot: m.isBot,
        connected: m.connected,
      })),
      version: room.version,
      game: toGameView(room.game, selfId),
      events: room.lastEvents,
    };
  }

  private human(name: string, socketId: string): Member {
    return {
      id: randomUUID(),
      name,
      isBot: false,
      connected: true,
      autoCut: false,
      socketId,
      token: randomBytes(32).toString('hex'),
    };
  }

  private session(room: Room, member: Member): Session {
    if (!member.token) throw new Error('Session requested for a member without token');
    return { token: member.token, playerId: member.id, code: room.code };
  }

  private freeCode(): string {
    let code: string;
    do code = randomBytes(2).toString('hex').toUpperCase();
    while (this.store.has(code));
    return code;
  }

  private requireHost(room: Room, member: Member, message: string): void {
    if (room.hostId !== member.id) throw new RoomError(message);
  }

  private reassignHost(room: Room): void {
    const host = room.members.get(room.hostId);
    if (host && !host.isBot && host.connected) return;
    const members = [...room.members.values()];
    const next = members.find((m) => !m.isBot && m.connected) ?? members.find((m) => !m.isBot);
    if (next) room.hostId = next.id;
  }

  /** Runs an action through the reducer and stores the result, without publishing. */
  private apply(room: Room, action: GameAction): readonly GameEvent[] {
    const result = transition(room.game, action);
    if (!result.ok) throw new RoomError(result.error.message);
    room.game = result.state;
    room.lastEvents = result.events;
    return result.events;
  }

  private dispatch(room: Room, action: GameAction): void {
    this.commit(room, this.apply(room, action));
  }

  /** Publishes one filtered snapshot per connected member, then plans the next automatic move. */
  private commit(room: Room, events: readonly GameEvent[]): void {
    room.version += 1;
    room.lastEvents = events;
    room.touchedAt = Date.now();
    for (const member of room.members.values())
      if (member.socketId) this.publish(member.socketId, this.snapshot(room, member.id));
    this.schedule(room);
  }

  private remove(room: Room): void {
    this.cancel(room);
    this.store.delete(room);
  }

  private cancel(room: Room): void {
    const timer = this.timers.get(room.code);
    if (timer) clearTimeout(timer);
    this.timers.delete(room.code);
  }

  private schedule(room: Room): void {
    this.cancel(room);
    // Nobody is watching: freeze the table instead of letting bots race through it.
    if (!hasConnectedHuman(room)) return;
    const next = this.automatedStep(room);
    if (!next) return;
    const timer = setTimeout(() => {
      this.timers.delete(room.code);
      if (this.store.get(room.code) !== room) return;
      // Recompute: the state may have changed since the step was planned.
      const step = this.automatedStep(room);
      if (!step) return;
      const result = transition(room.game, step.action);
      if (!result.ok)
        throw new Error(`Automated ${step.action.type} rejected: ${result.error.code}`);
      room.game = result.state;
      this.commit(room, result.events);
    }, next.delay);
    timer.unref();
    this.timers.set(room.code, timer);
  }

  /** Short enough to beat any bot, long enough to see the card that made the square. */
  private autoCutDelay(): number {
    return Math.round(this.options.pacing.botDelay * 0.35);
  }

  private thinkingTime(): number {
    return Math.round(this.options.pacing.botDelay * (0.75 + Math.random() * 0.5));
  }

  /** Next move the server performs on its own: finishing a deal, or a bot/absent player's turn. */
  private automatedStep(room: Room): Scheduled | null {
    const { game } = room;
    const { pacing } = this.options;
    if (game.phase === 'dealing')
      return { action: { type: 'completeDeal' }, delay: pacing.dealDelay };
    const automated = [...room.members.values()].filter(isAutomated);
    const pause = room.lastEvents.some((e) => e.type === 'trickCleared') ? pacing.clearPause : 0;
    if (game.phase === 'exchanging') {
      for (const member of automated) {
        const action = chooseBotAction(game, member.id);
        if (action) return { action, delay: this.thinkingTime() };
      }
      return null;
    }
    if (game.phase !== 'playing') return null;
    // Players who asked for it cut first, faster than any bot can react.
    for (const member of room.members.values()) {
      if (!member.autoCut || isAutomated(member) || member.id === game.turn) continue;
      const [cut] = legalPlays(game, member.id);
      if (cut)
        return {
          action: { type: 'play', playerId: member.id, cards: cut },
          delay: this.autoCutDelay(),
        };
    }
    // Squares can be laid out of turn: give automated players that chance first.
    for (const member of automated) {
      if (member.id === game.turn) continue;
      const action = chooseBotAction(game, member.id);
      if (action) return { action, delay: pause + this.thinkingTime() };
    }
    const current = room.members.get(game.turn);
    if (!current || !isAutomated(current)) return null;
    const action = chooseBotAction(game, current.id);
    return action ? { action, delay: pause + this.thinkingTime() } : null;
  }
}
