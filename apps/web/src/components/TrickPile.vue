<script setup lang="ts">
import { computed } from 'vue';
import { RefreshCw, Spade } from '@lucide/vue';
import { useGameStore } from '../stores/game';
import { FORMAT_LABELS } from '../lib/describe';
import PlayingCard from './PlayingCard.vue';

const store = useGameStore();
const game = computed(() => store.game!);

/** The live trick, or the trick that was just cleared while it is shown one last time. */
const pile = computed(() => {
  const trick = game.value.trick;
  if (trick)
    return {
      key: `trick-${trick.plays[0]?.cards[0]?.id ?? ''}-${trick.plays[0]?.playerId ?? ''}`,
      plays: trick.plays,
      cleared: null,
    };
  if (store.cleared)
    return {
      key: `cleared-${store.cleared.id}`,
      plays: store.cleared.plays,
      cleared: store.cleared.reason,
    };
  return null;
});
const visiblePlays = computed(() => pile.value?.plays.slice(-3) ?? []);
const CLEAR_LABELS = {
  two: 'Le 2 remporte le pli',
  square: 'Carré !',
  allPassed: 'Pli remporté',
  presidentOut: 'Premier sorti',
} as const;
</script>

<template>
  <div
    class="glass relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-moss-soft/40 px-4 py-8"
    data-testid="table"
    :data-phase="game.phase"
    :data-format="game.trick?.format ?? 0"
    :data-rank="game.trick?.rank ?? 0"
    :data-same="game.trick?.sameRankRequired ?? false"
  >
    <div class="absolute top-4 left-4 flex items-center gap-2 text-xs text-ink-soft">
      <span class="rounded-full bg-white/70 px-2.5 py-1 font-semibold"
        >Manche {{ game.round }}</span
      >
      <span
        class="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1"
        data-testid="direction"
      >
        <RefreshCw
          :size="12"
          class="transition-transform duration-500"
          :class="game.isReversed ? '-scale-x-100' : ''"
        />
        {{ game.isReversed ? 'Sens inversé' : 'Sens horaire' }}
      </span>
    </div>

    <Transition name="sweep" mode="out-in">
      <div v-if="pile" :key="pile.key" class="flex flex-col items-center gap-3">
        <TransitionGroup
          name="land"
          tag="div"
          class="relative flex h-32 items-center justify-center"
        >
          <div
            v-for="(play, i) in visiblePlays"
            :key="play.cards.map((c) => c.id).join('+')"
            class="flex -space-x-8 transition-transform duration-300"
            :class="i < visiblePlays.length - 1 ? 'absolute scale-90 opacity-50' : 'relative'"
            :style="{
              transform: `translate(${(i - visiblePlays.length + 1) * 26}px, ${(i - visiblePlays.length + 1) * 6}px)`,
            }"
          >
            <PlayingCard v-for="card in play.cards" :key="card.id" :card="card" />
          </div>
        </TransitionGroup>
        <p class="text-center text-sm text-ink-soft" aria-live="polite">
          <template v-if="pile.cleared">
            <strong class="text-moss">{{ CLEAR_LABELS[pile.cleared] }}</strong>
          </template>
          <template v-else-if="game.trick">
            {{ store.nameOf(game.trick.ownerId) }} · {{ FORMAT_LABELS[game.trick.format] }}
            <strong
              v-if="game.trick.sameRankRequired"
              class="ml-1 rounded-full bg-gold/15 px-2 py-0.5 text-gold"
            >
              Même carte ou passe
            </strong>
          </template>
        </p>
      </div>
      <div v-else key="empty" class="flex flex-col items-center gap-2 text-center text-ink-soft">
        <Spade :size="30" :stroke-width="1.3" />
        <p class="font-display text-xl text-ink">Un nouveau pli, tout est possible.</p>
        <p class="text-sm">
          {{ store.isMyTurn ? 'À vous de l’ouvrir.' : `${store.nameOf(game.turn)} ouvre le pli.` }}
        </p>
      </div>
    </Transition>
  </div>
</template>
