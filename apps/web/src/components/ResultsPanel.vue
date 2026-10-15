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
const iWon = computed(() => standings.value[0]?.id === store.selfId);

/** A soft rain of suits, deterministic per index so it never reflows between renders. */
const SUITS = ['♠', '♥', '♦', '♣'] as const;
const drops = Array.from({ length: 36 }, (_, i) => ({
  suit: SUITS[i % 4]!,
  left: (i * 37) % 100,
  delay: ((i * 13) % 40) / 10,
  duration: 5 + ((i * 7) % 30) / 10,
  drift: ((i * 17) % 120) - 60,
  size: 0.9 + ((i * 11) % 10) / 10,
}));
const PODIUM = ['bg-banana', 'bg-sky', 'bg-peach'] as const;
</script>

<template>
  <div>
    <div class="suit-rain pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <span
        v-for="(d, i) in drops"
        :key="i"
        class="font-display [-webkit-text-stroke:1.5px_var(--color-ink)] [paint-order:stroke]"
        :class="d.suit === '♥' || d.suit === '♦' ? 'text-coral' : 'text-lilac'"
        :style="{
          left: `${d.left}%`,
          fontSize: `${d.size}rem`,
          '--d': `${d.delay}s`,
          '--t': `${d.duration}s`,
          '--drift': `${d.drift}px`,
          '--spin': `${d.drift * 6}deg`,
        }"
        >{{ d.suit }}</span
      >
    </div>
    <section
      class="panel-lg relative z-10 mx-auto max-w-xl rounded-[2rem] p-6 text-center sm:p-10"
      data-testid="results"
    >
      <span
        class="crown-pop mx-auto grid size-20 place-items-center rounded-full border-4 border-ink bg-banana shadow-md"
        ><Crown :size="38" :stroke-width="2.2"
      /></span>
      <p class="pill mt-5 bg-mint">Manche {{ game.round }} terminée</p>
      <h2 class="mt-3 font-display text-3xl font-bold">
        <template v-if="iWon">Vous, <span class="hl">à vous la présidence.</span></template>
        <template v-else
          >{{ standings[0]?.name }}, <span class="hl">à vous la présidence.</span></template
        >
      </h2>
      <TransitionGroup name="fade" tag="ol" appear class="mt-6 space-y-2 text-left">
        <li
          v-for="(seat, i) in standings"
          :key="seat.id"
          class="flex items-center gap-3 rounded-2xl border-3 border-ink px-4 py-3 shadow-sm"
          :class="PODIUM[i] ?? 'bg-paper'"
          :style="{ transitionDelay: `${i * 90}ms` }"
          data-testid="standing"
        >
          <span class="w-6 font-display text-sm font-bold">{{
            String(i + 1).padStart(2, '0')
          }}</span>
          <strong class="flex-1 font-display">
            {{ seat.name }}
            <small v-if="seat.id === store.selfId" class="font-sans font-medium text-ink-soft"
              >vous</small
            >
          </strong>
          <span class="text-sm font-medium">{{ roleLabel(seat.role) }}</span>
          <span v-if="seat.penalized" class="pill bg-coral">fini sur un 2</span>
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
      <p v-else class="mt-8 text-sm font-medium text-ink-soft">
        L’hôte peut lancer la prochaine manche.
      </p>
    </section>
  </div>
</template>

<style scoped>
.hl {
  background: linear-gradient(transparent 58%, var(--color-banana) 58% 92%, transparent 92%);
}
</style>
