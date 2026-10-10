<script setup lang="ts">
import { computed } from 'vue';
import { Bot, Crown, WifiOff } from '@lucide/vue';
import type { MemberView, PublicSeat } from '@president/shared';
import { placeLabel, roleLabel } from '../lib/describe';

const props = defineProps<{ seat: PublicSeat; member: MemberView | undefined; active: boolean }>();

const status = computed(() => {
  const { seat } = props;
  if (seat.penalized) return 'Puni par le 2';
  if (seat.status === 'finished') return seat.place ? `Sorti · ${placeLabel(seat.place)}` : 'Sorti';
  if (seat.status === 'passed') return 'Passe';
  return `${seat.cardCount} carte${seat.cardCount > 1 ? 's' : ''}`;
});
</script>

<template>
  <div
    class="glass relative flex min-w-36 items-center gap-3 rounded-2xl px-3 py-2.5 transition duration-300"
    :class="[
      active ? 'bg-white/85 ring-2 ring-moss/50 shadow-(--shadow-lift)' : '',
      seat.status === 'finished' || seat.status === 'passed' ? 'opacity-60' : '',
    ]"
    :data-testid="`seat-${seat.id}`"
    :data-cards="seat.cardCount"
    :aria-current="active ? 'true' : undefined"
  >
    <span
      class="relative grid size-10 shrink-0 place-items-center rounded-full bg-moss-soft font-semibold text-moss"
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
      class="absolute -top-2 right-3 rounded-full bg-moss px-2 py-0.5 text-[0.65rem] font-semibold text-white"
    >
      À son tour
    </span>
  </div>
</template>
