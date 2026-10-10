<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import ActivityFeed from './ActivityFeed.vue';
import HandPanel from './HandPanel.vue';
import PlayerSeat from './PlayerSeat.vue';
import TrickPile from './TrickPile.vue';

const store = useGameStore();
const game = computed(() => store.game!);

/** Opponents listed in play order starting after the viewer, so the table reads naturally. */
const opponents = computed(() => {
  const seats = game.value.seats;
  const start = seats.findIndex((s) => s.id === store.selfId);
  return seats.slice(start + 1).concat(seats.slice(0, Math.max(start, 0)));
});
const memberOf = (id: string) => store.snapshot?.members.find((m) => m.id === id);
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[1fr_18rem]">
    <div class="flex min-w-0 flex-col gap-5">
      <TransitionGroup
        name="fade"
        tag="div"
        class="flex flex-wrap justify-center gap-x-3 gap-y-4 pt-2"
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
      </TransitionGroup>
      <TrickPile />
      <HandPanel />
    </div>
    <ActivityFeed class="hidden lg:block" />
  </div>
</template>
