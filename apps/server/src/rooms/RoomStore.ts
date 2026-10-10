import type { PlayerId } from '@president/shared';
import type { Member, Room } from './Room';

interface SessionRef {
  readonly code: string;
  readonly playerId: PlayerId;
}

/** In-memory indexes: every lookup used on a hot path is O(1). */
export class RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, SessionRef>();

  get size(): number {
    return this.rooms.size;
  }
  get sessionCount(): number {
    return this.sessions.size;
  }
  has(code: string): boolean {
    return this.rooms.has(code);
  }
  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }
  values(): IterableIterator<Room> {
    return this.rooms.values();
  }
  add(room: Room): void {
    this.rooms.set(room.code, room);
    for (const member of room.members.values()) this.index(room, member);
  }
  index(room: Room, member: Member): void {
    if (member.token) this.sessions.set(member.token, { code: room.code, playerId: member.id });
  }
  revoke(member: Member): void {
    if (member.token) this.sessions.delete(member.token);
    member.token = null;
  }
  delete(room: Room): void {
    for (const member of room.members.values()) this.revoke(member);
    this.rooms.delete(room.code);
  }
  /** Resolves a reconnection token to its room and member. */
  resolve(token: string): { room: Room; member: Member } | null {
    const ref = this.sessions.get(token);
    const room = ref && this.rooms.get(ref.code);
    const member = room?.members.get(ref!.playerId);
    return room && member ? { room, member } : null;
  }
}
