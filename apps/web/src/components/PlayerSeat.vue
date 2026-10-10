<script setup lang="ts">
import { computed } from 'vue';
import { Bot, Crown, Scissors, WifiOff } from '@lucide/vue';
import type { MemberView, PublicSeat } from '@president/shared';
import { placeLabel, roleLabel } from '../lib/describe';
import type { SeatAction } from '../stores/game';
import PlayingCard from './PlayingCard.vue';

const props = defineProps<{
  seat: PublicSeat;
  member: MemberView | undefined;
  active: boolean;
  action: SeatAction | undefined;
}>();

const status = computed(() => {
  const { seat } = props;
  if (seat.penalized) return 'Puni par le 2';
  if (seat.status === 'finished') return seat.place ? `Sorti · ${placeLabel(seat.place)}` : 'Sorti';
  if (seat.status === 'passed') return 'Passe';
  return `${seat.cardCount} carte${seat.cardCount > 1 ? 's' : ''}`;
});
</script>

<template>
  <div class="relative flex flex-col items-center">
    <div
      class="glass relative flex min-w-36 items-center gap-3 rounded-2xl px-3 py-2.5 transition duration-300"
      :class="[
        active ? 'seat-active scale-105 bg-white/90' : '',
        !active && (seat.status === 'finished' || seat.status === 'passed') ? 'opacity-55' : '',
      ]"
      :data-testid="`seat-${seat.id}`"
      :data-cards="seat.cardCount"
      :aria-current="active ? 'true' : undefined"
    >
      <span
        class="relative grid size-10 shrink-0 place-items-center rounded-full font-semibold transition-colors"
        :class="active ? 'bg-moss text-white' : 'bg-moss-soft text-moss'"
      >
        {{ seat.name.slice(0, 1).toUpperCase() }}
        <span
          v-if="member?.isBot || !member?.connected"
          class="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-white text-ink-soft shadow"
          :title="member?.isBot ? 'Bot' : 'Déconnecté : un bot joue à sa place'"
        >
          <Bot v-if="member?.isBot" :size="12" />
          <WifiOff v-else :size="11" />
        </span>
      </span>
      <span class="min-w-0">
        <strong class="flex items-center gap-1 truncate text-sm">
          {{ seat.name }}
          <Crown v-if="seat.role === 'president'" :size="14" class="text-gold" />
        </strong>
        <span class="block text-xs text-ink-soft">{{ status }}</span>
        <span v-if="seat.role !== 'neutral'" class="block text-[0.68rem] text-ink-soft/80">{{
          roleLabel(seat.role)
        }}</span>
      </span>
      <span
        v-if="active"
        class="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-moss px-2.5 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap text-white shadow"
      >
        À son tour
        <span class="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </div>

    <!-- What this seat just did: cards fly up from it, or a "Passe" bubble. -->
    <Transition name="seat-action">
      <div
        v-if="action"
        :key="action.id"
        class="pointer-events-none absolute top-full z-20 mt-2 flex flex-col items-center"
        :data-testid="`seat-action-${seat.id}`"
        :data-kind="action.kind"
      >
        <div v-if="action.cards.length" class="flex -space-x-6">
          <PlayingCard v-for="card in action.cards" :key="card.id" :card="card" size="sm" />
        </div>
        <span
          class="mt-1 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow"
          :class="{
            'bg-white text-ink': action.kind === 'play',
            'bg-gold text-white': action.kind === 'cut' || action.kind === 'out',
            'bg-ink-soft text-white': action.kind === 'pass',
          }"
        >
          <Scissors v-if="action.kind === 'cut'" :size="12" />
          {{ { play: 'Pose', cut: 'Coupe !', pass: 'Passe', out: 'Terminé !' }[action.kind] }}
        </span>
      </div>
    </Transition>
  </div>
</template>
