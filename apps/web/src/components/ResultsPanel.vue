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
const PODIUM = [
  'border-gold/60 bg-gold/15',
  'border-ink-soft/40 bg-surface/70',
  'border-[#b07a4f]/50 bg-[#b07a4f]/10',
] as const;
</script>

<template>
  <div>
    <div class="suit-rain pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <span
        v-for="(d, i) in drops"
        :key="i"
        :class="d.suit === '♥' || d.suit === '♦' ? 'text-heart/50' : 'text-champagne/40'"
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
      class="glass-strong relative z-10 mx-auto max-w-xl rounded-[2rem] p-6 text-center sm:p-10"
      data-testid="results"
    >
      <span
        class="crown-pop mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-b from-champagne to-gold text-[#1d1608] shadow-[0_18px_40px_-14px_var(--color-gold)]"
        ><Crown :size="38"
      /></span>
      <p class="eyebrow mt-4">Manche {{ game.round }} terminée</p>
      <h2 class="mt-2 font-display text-3xl">
        <template v-if="iWon">Vous, <em class="text-gold">à vous la présidence.</em></template>
        <template v-else
          >{{ standings[0]?.name }}, <em class="text-gold">à vous la présidence.</em></template
        >
      </h2>
      <TransitionGroup name="fade" tag="ol" appear class="mt-6 space-y-2 text-left">
        <li
          v-for="(seat, i) in standings"
          :key="seat.id"
          class="flex items-center gap-3 rounded-2xl border px-4 py-3"
          :class="PODIUM[i] ?? 'border-transparent bg-surface/50'"
          :style="{ transitionDelay: `${i * 90}ms` }"
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
          <span
            v-if="seat.penalized"
            class="rounded-full bg-heart/10 px-2 py-0.5 text-xs text-heart"
            >fini sur un 2</span
          >
        </li>
      </TransitionGroup>
      <button
        v-if="store.isHost"
        type="button"
        class="btn-gold mt-8"
        :disabled="store.pending || !store.connected"
        @click="store.nextRound()"
      >
        La revanche ? <RefreshCw :size="16" />
      </button>
      <p v-else class="mt-8 text-sm text-ink-soft">L’hôte peut lancer la prochaine manche.</p>
    </section>
  </div>
</template>
