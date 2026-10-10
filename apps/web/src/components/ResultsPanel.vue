<script setup lang="ts">
import { computed } from 'vue';
import { Crown, RefreshCw } from '@lucide/vue';
import { useGameStore } from '../stores/game';
import { roleLabel } from '../lib/describe';

const store = useGameStore();
const game = computed(() => store.game!);
const standings = computed(() =>
  game.value.ranking.map((id) => game.value.seats.find((s) => s.id === id)!).filter(Boolean),
);
</script>

<template>
  <section
    class="glass mx-auto max-w-xl rounded-[2rem] p-6 text-center sm:p-10"
    data-testid="results"
  >
    <span class="mx-auto grid size-16 place-items-center rounded-full bg-gold/15 text-gold"
      ><Crown :size="32"
    /></span>
    <p class="eyebrow mt-4">Manche {{ game.round }} terminée</p>
    <h2 class="mt-2 font-display text-3xl">
      {{ standings[0]?.name }}, <em class="text-moss">à vous la présidence.</em>
    </h2>
    <TransitionGroup name="fade" tag="ol" appear class="mt-6 space-y-2 text-left">
      <li
        v-for="(seat, i) in standings"
        :key="seat.id"
        class="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3"
        :style="{ transitionDelay: `${i * 70}ms` }"
        data-testid="standing"
      >
        <span class="w-6 font-mono text-sm text-ink-soft">{{
          String(i + 1).padStart(2, '0')
        }}</span>
        <strong class="flex-1">
          {{ seat.name }}
          <small v-if="seat.id === store.selfId" class="font-normal text-ink-soft">vous</small>
        </strong>
        <span class="text-sm text-ink-soft">{{ roleLabel(seat.role) }}</span>
        <span v-if="seat.penalized" class="rounded-full bg-heart/10 px-2 py-0.5 text-xs text-heart"
          >fini sur un 2</span
        >
      </li>
    </TransitionGroup>
    <button
      v-if="store.isHost"
      type="button"
      class="btn-primary mt-8"
      :disabled="store.pending || !store.connected"
      @click="store.nextRound()"
    >
      La revanche ? <RefreshCw :size="16" />
    </button>
    <p v-else class="mt-8 text-sm text-ink-soft">L’hôte peut lancer la prochaine manche.</p>
  </section>
</template>
