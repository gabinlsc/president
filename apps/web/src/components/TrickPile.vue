<script setup lang="ts">
import { computed, inject } from 'vue';
import type { Play } from '@president/shared';
import { useGameStore } from '../stores/game';
import { FORMAT_LABELS } from '../lib/describe';
import { SEAT_OFFSET } from '../lib/seating';
import PlayingCard from './PlayingCard.vue';

const store = useGameStore();
const game = computed(() => store.game!);
const seatOffset = inject(SEAT_OFFSET, () => ({ x: 0, y: 160 }));

/** The live trick, or the trick that was just cleared while it is shown one last time. */
const pile = computed(() => {
  const trick = game.value.trick;
  if (trick)
    return {
      key: `trick-${trick.plays[0]?.cards[0]?.id ?? ''}-${trick.plays[0]?.playerId ?? ''}`,
      plays: trick.plays,
      cleared: null,
      leaderId: null,
    };
  if (store.cleared)
    return {
      key: `cleared-${store.cleared.id}`,
      plays: store.cleared.plays,
      cleared: store.cleared.reason,
      leaderId: store.cleared.leaderId,
    };
  return null;
});
const visiblePlays = computed(() => pile.value?.plays.slice(-4) ?? []);

/** Stable small tilt per play, so the pile looks hand-thrown rather than stacked by a robot. */
function tilt(play: Play): number {
  const id = play.cards[0]?.id ?? '';
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 17) - 8;
}

function flyFrom(play: Play): Record<string, string> {
  const { x, y } = seatOffset(play.playerId);
  return {
    '--from-x': `${x}px`,
    '--from-y': `${y}px`,
    '--from-r': `${x > 0 ? 25 : -25}deg`,
    '--rest-r': `${tilt(play)}deg`,
  };
}
const sweepTo = computed(() => {
  const { x, y } = seatOffset(pile.value?.leaderId ?? null);
  return { '--to-x': `${x}px`, '--to-y': `${y}px` };
});
const CLEAR_LABELS = {
  two: 'Le 2 remporte le pli',
  square: 'Carré !',
  allPassed: 'Pli remporté',
  presidentOut: 'Premier sorti',
} as const;
</script>

<template>
  <div class="relative flex flex-col items-center" aria-live="polite">
    <Transition name="sweep" mode="out-in">
      <div v-if="pile" :key="pile.key" class="relative flex flex-col items-center" :style="sweepTo">
        <div class="relative grid h-36 w-48 place-items-center">
          <div
            v-for="(play, i) in visiblePlays"
            :key="play.cards.map((c) => c.id).join('+')"
            class="fly-in absolute flex -space-x-9"
            :class="i < visiblePlays.length - 1 ? 'brightness-[0.92]' : 'z-10'"
            :style="flyFrom(play)"
          >
            <PlayingCard v-for="card in play.cards" :key="card.id" :card="card" />
            <span
              v-if="i === visiblePlays.length - 1"
              class="pill absolute -top-8 left-1/2 -translate-x-1/2 -rotate-3 bg-banana shadow-sm"
              data-testid="trick-author"
            >
              {{ play.playerId === store.selfId ? 'Vous' : store.nameOf(play.playerId) }}
            </span>
          </div>
        </div>
        <p class="mt-2 min-h-6 text-center text-sm font-semibold">
          <strong
            v-if="pile.cleared"
            class="inline-block -rotate-2 rounded-xl border-3 border-ink bg-banana px-3 py-0.5 font-display text-lg shadow-sm"
            >{{ CLEAR_LABELS[pile.cleared] }}</strong
          >
          <template v-else-if="game.trick">
            {{ FORMAT_LABELS[game.trick.format] }}
            <strong v-if="game.trick.sameRankRequired" class="pill ml-1 bg-coral">
              Même carte ou passe
            </strong>
          </template>
        </p>
      </div>
      <div v-else key="empty" class="flex flex-col items-center gap-1 text-center">
        <span class="font-display text-4xl tracking-widest text-ink/25" aria-hidden="true"
          >♠♥♦♣</span
        >
        <p class="font-display text-2xl font-bold">Un nouveau pli</p>
        <p class="text-sm font-medium">
          {{ store.isMyTurn ? 'À vous de l’ouvrir.' : `${store.nameOf(game.turn)} ouvre le pli.` }}
        </p>
      </div>
    </Transition>
  </div>
</template>
