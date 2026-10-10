<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { RotateCw } from '@lucide/vue';
import type { PlayerId } from '@president/shared';
import { useGameStore } from '../stores/game';
import { SEAT_OFFSET, SELF_SPOT, opponentSpots } from '../lib/seating';
import ActivityFeed from './ActivityFeed.vue';
import HandPanel from './HandPanel.vue';
import PlayerSeat from './PlayerSeat.vue';
import TrickPile from './TrickPile.vue';

const store = useGameStore();
const game = computed(() => store.game!);

/** Opponents in play order starting after the viewer, laid out left to right over the felt. */
const opponents = computed(() => {
  const seats = game.value.seats;
  const start = seats.findIndex((s) => s.id === store.selfId);
  return seats.slice(start + 1).concat(seats.slice(0, Math.max(start, 0)));
});
const spots = computed(() => opponentSpots(opponents.value.length));
const memberOf = (id: string) => store.snapshot?.members.find((m) => m.id === id);

/** Around the oval on wide screens, in a scrollable row on phones: one set of seats only. */
const wide = ref(true);
let media: MediaQueryList | null = null;
const syncWide = () => (wide.value = media?.matches ?? true);

const felt = ref<HTMLElement | null>(null);
const size = ref({ w: 800, h: 420 });
let observer: ResizeObserver | null = null;
onMounted(() => {
  media = window.matchMedia('(min-width: 768px)');
  syncWide();
  media.addEventListener('change', syncWide);
  observer = new ResizeObserver(([entry]) => {
    if (entry) size.value = { w: entry.contentRect.width, h: entry.contentRect.height };
  });
  if (felt.value) observer.observe(felt.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  media?.removeEventListener('change', syncWide);
});

provide(SEAT_OFFSET, (id: PlayerId | null) => {
  const index = opponents.value.findIndex((s) => s.id === id);
  const spot = index >= 0 ? spots.value[index]! : SELF_SPOT;
  return { x: ((spot.x - 50) / 100) * size.value.w, y: ((spot.y - 50) / 100) * size.value.h };
});
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1fr_17rem]">
    <div class="flex min-w-0 flex-col gap-6">
      <!-- Phone: opponents in a scrollable row above the felt -->
      <div
        v-if="!wide"
        class="-mx-4 flex gap-3 overflow-x-auto px-4 pt-2 pb-14"
        aria-label="Adversaires"
      >
        <PlayerSeat
          v-for="seat in opponents"
          :key="seat.id"
          :seat="seat"
          :member="memberOf(seat.id)"
          :active="game.phase === 'playing' && game.turn === seat.id"
          :action="store.seatActions[seat.id]"
        />
      </div>

      <div class="relative md:px-20 md:pt-36 md:pb-6">
        <div
          ref="felt"
          class="felt relative mx-auto grid min-h-72 w-full place-items-center rounded-[3rem] md:aspect-[2.1/1] md:rounded-[50%]"
          data-testid="table"
          :data-phase="game.phase"
          :data-format="game.trick?.format ?? 0"
          :data-rank="game.trick?.rank ?? 0"
          :data-same="game.trick?.sameRankRequired ?? false"
        >
          <!-- Direction of play, drawn on the cloth -->
          <div
            class="pointer-events-none absolute inset-[18%] rounded-[50%] border border-dashed border-champagne/10"
            aria-hidden="true"
          />
          <div
            class="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 text-[0.68rem] font-semibold tracking-[0.2em] whitespace-nowrap text-champagne/70 uppercase md:bottom-[11%]"
            data-testid="direction"
          >
            <span>Manche {{ game.round }}</span>
            <span class="size-1 rounded-full bg-champagne/40" />
            <RotateCw
              :size="13"
              class="transition-transform duration-700"
              :class="game.isReversed ? '-scale-x-100' : ''"
            />
            <span>{{ game.isReversed ? 'Sens inversé' : 'Sens horaire' }}</span>
          </div>
          <TrickPile />
        </div>

        <!-- Desktop: opponents around the top of the oval -->
        <div
          v-for="(seat, i) in wide ? opponents : []"
          :key="seat.id"
          class="absolute -translate-x-1/2 -translate-y-1/2"
          :style="{
            left: `calc(5rem + (100% - 10rem) * ${spots[i]!.x / 100})`,
            top: `calc(9rem + (100% - 10.5rem) * ${spots[i]!.y / 100})`,
          }"
        >
          <PlayerSeat
            :seat="seat"
            :member="memberOf(seat.id)"
            :active="game.phase === 'playing' && game.turn === seat.id"
            :action="store.seatActions[seat.id]"
          />
        </div>
      </div>

      <HandPanel />
    </div>
    <ActivityFeed class="hidden xl:block" />
  </div>
</template>
