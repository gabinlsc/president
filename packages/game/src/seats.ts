import type { PlayerId, PlayerState } from '@president/shared';
import { ensure } from './violations';

interface Table {
  readonly seats: readonly PlayerState[];
  readonly isReversed: boolean;
}

export function seatOf(table: Table, id: PlayerId): PlayerState {
  const seat = table.seats.find((s) => s.id === id);
  ensure(seat, 'UNKNOWN_PLAYER');
  return seat;
}

export const isActive = (seat: PlayerState): boolean => seat.hand.length > 0;

/**
 * Walks around the table from `fromId` in the current direction and returns the first seat
 * accepted by `accept`. `fromId` itself is visited last.
 */
export function nextSeat(
  table: Table,
  fromId: PlayerId,
  accept: (seat: PlayerState) => boolean,
): PlayerId | null {
  const count = table.seats.length;
  const start = table.seats.findIndex((s) => s.id === fromId);
  const step = table.isReversed ? -1 : 1;
  for (let k = 1; k <= count; k++) {
    const seat = table.seats[(((start + step * k) % count) + count) % count]!;
    if (accept(seat)) return seat.id;
  }
  return null;
}

/** Lead of a fresh trick: `id` keeps it while holding cards, otherwise the next active seat. */
export const leaderAfter = (table: Table, id: PlayerId): PlayerId | null =>
  isActive(seatOf(table, id)) ? id : nextSeat(table, id, isActive);
