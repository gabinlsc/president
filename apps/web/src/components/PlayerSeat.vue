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
/** A small fan of card backs showing roughly how many cards are left. */
const backs = computed(() => Math.min(props.seat.cardCount, 7));
const dimmed = computed(
  () => !props.active && (props.seat.status === 'finished' || props.seat.status === 'passed'),
);
</script>

<template>
  <div
    class="relative flex w-32 flex-col items-center transition duration-500"
    :class="dimmed ? 'opacity-50' : ''"
  >
    <!-- Hidden hand -->
    <div class="relative mb-[-0.9rem] flex h-11 items-end justify-center" aria-hidden="true">
      <span
        v-for="i in backs"
        :key="i"
        class="absolute bottom-0 origin-bottom transition-transform duration-500"
        :style="{
          transform: `rotate(${(i - (backs + 1) / 2) * 9}deg) translateY(${Math.abs(i - (backs + 1) / 2) * 1.5}px)`,
        }"
      >
        <PlayingCard size="xs" face-down />
      </span>
    </div>

    <div
      class="glass relative z-10 flex w-full flex-col items-center rounded-2xl px-2 pt-2 pb-2.5 text-center transition duration-300"
      :class="active ? 'seat-active scale-105' : ''"
      :data-testid="`seat-${seat.id}`"
      :data-cards="seat.cardCount"
      :aria-current="active ? 'true' : undefined"
    >
      <span class="relative grid size-11 place-items-center rounded-full">
        <span v-if="active" class="turn-ring" aria-hidden="true" />
        <span
          class="grid size-11 place-items-center rounded-full font-display text-lg transition-colors duration-300"
          :class="active ? 'bg-gold text-[#1d1608]' : 'bg-moss-soft text-moss'"
        >
          {{ seat.name.slice(0, 1).toUpperCase() }}
        </span>
        <span
          v-if="member?.isBot || !member?.connected"
          class="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-surface text-ink-soft shadow"
          :title="member?.isBot ? 'Bot' : 'Déconnecté : un bot joue à sa place'"
        >
          <Bot v-if="member?.isBot" :size="12" />
          <WifiOff v-else :size="11" />
        </span>
        <Crown
          v-if="seat.role === 'president'"
          :size="18"
          class="absolute -top-3.5 left-1/2 -translate-x-1/2 text-gold drop-shadow"
        />
      </span>
      <strong class="mt-1.5 max-w-full truncate text-sm">{{ seat.name }}</strong>
      <span class="text-[0.7rem] text-ink-soft">{{ status }}</span>
      <span
        v-if="seat.role !== 'neutral'"
        class="mt-1 rounded-full bg-gold/12 px-2 py-px text-[0.62rem] font-medium text-gold"
        >{{ roleLabel(seat.role) }}</span
      >
      <span
        v-if="active"
        class="absolute -bottom-2.5 flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[0.62rem] font-semibold whitespace-nowrap text-[#1d1608] shadow"
      >
        À son tour <span class="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </div>

    <!-- What this seat just did -->
    <Transition name="seat-action">
      <div
        v-if="action"
        :key="action.id"
        class="pointer-events-none absolute top-full z-20 mt-4 flex flex-col items-center"
        :data-testid="`seat-action-${seat.id}`"
        :data-kind="action.kind"
      >
        <div v-if="action.cards.length && action.kind !== 'play'" class="flex -space-x-6">
          <PlayingCard v-for="card in action.cards" :key="card.id" :card="card" size="sm" />
        </div>
        <span
          class="mt-1 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-lg"
          :class="{
            'bg-surface text-ink': action.kind === 'play',
            'bg-gold text-[#1d1608]': action.kind === 'cut' || action.kind === 'out',
            'bg-ink-soft text-sand': action.kind === 'pass',
          }"
        >
          <Scissors v-if="action.kind === 'cut'" :size="12" />
          {{ { play: 'Pose', cut: 'Coupe !', pass: 'Passe', out: 'Terminé !' }[action.kind] }}
        </span>
      </div>
    </Transition>
  </div>
</template>
