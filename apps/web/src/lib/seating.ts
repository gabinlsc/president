import type { InjectionKey } from 'vue';
import type { PlayerId } from '@president/shared';

/** Position of a seat around the oval, in percent of the table box (50/50 is the centre). */
export interface SeatSpot {
  readonly x: number;
  readonly y: number;
}

/** Opponents spread over the top arc, from the viewer's left to their right. */
export function opponentSpots(count: number): SeatSpot[] {
  return Array.from({ length: count }, (_, k) => {
    const angle = ((200 + (140 * (k + 1)) / (count + 1)) * Math.PI) / 180;
    return { x: 50 + 50 * Math.cos(angle), y: 50 + 62 * Math.sin(angle) };
  });
}

/** The viewer always sits at the bottom, just below the felt. */
export const SELF_SPOT: SeatSpot = { x: 50, y: 108 };

/** Pixel offset from the felt centre to a seat, used to fly cards from and to players. */
export type SeatOffset = (id: PlayerId | null) => { x: number; y: number };
export const SEAT_OFFSET: InjectionKey<SeatOffset> = Symbol('seat-offset');
