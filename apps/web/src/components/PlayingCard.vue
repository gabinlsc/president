<script setup lang="ts">
import { computed } from 'vue';
import { SUIT_NAMES, SUIT_SYMBOLS, rankLabel, type Card } from '@president/shared';

const props = withDefaults(
  defineProps<{
    card: Card;
    size?: 'sm' | 'md' | 'lg';
    selected?: boolean;
    interactive?: boolean;
    playable?: boolean;
  }>(),
  { size: 'md', selected: false, interactive: false, playable: true },
);
defineEmits<{ select: [] }>();

const red = computed(() => props.card.suit === 'hearts' || props.card.suit === 'diamonds');
const label = computed(() => `${rankLabel(props.card.rank)} de ${SUIT_NAMES[props.card.suit]}`);
const sizes = {
  sm: 'h-[4.6rem] w-[3.3rem] rounded-lg text-[0.8rem]',
  md: 'h-[6.4rem] w-[4.5rem] rounded-xl text-base',
  lg: 'h-[7.6rem] w-[5.4rem] rounded-xl text-lg',
} as const;
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    :aria-pressed="interactive ? selected : undefined"
    :aria-label="label"
    :data-card="card.id"
    :data-rank="card.rank"
    :data-suit="card.suit"
    :data-playable="interactive ? playable : undefined"
    class="relative flex shrink-0 flex-col justify-between border bg-white/95 p-1.5 font-semibold shadow-(--shadow-card) transition duration-200 select-none"
    :class="[
      sizes[size],
      red ? 'text-heart' : 'text-ink',
      selected
        ? '-translate-y-4 border-moss shadow-(--shadow-lift) ring-2 ring-moss/40'
        : 'border-white',
      interactive && !selected ? 'hover:-translate-y-1.5 hover:shadow-(--shadow-lift)' : '',
      interactive && !playable && !selected ? 'opacity-75' : '',
    ]"
    @click="interactive && $emit('select')"
  >
    <span class="flex flex-col items-start leading-none" aria-hidden="true">
      <b>{{ rankLabel(card.rank) }}</b>
      <span class="text-[0.85em]">{{ SUIT_SYMBOLS[card.suit] }}</span>
    </span>
    <span class="absolute inset-0 grid place-items-center text-[2em] opacity-90" aria-hidden="true">
      {{ SUIT_SYMBOLS[card.suit] }}
    </span>
    <span class="flex rotate-180 flex-col items-start leading-none" aria-hidden="true">
      <b>{{ rankLabel(card.rank) }}</b>
      <span class="text-[0.85em]">{{ SUIT_SYMBOLS[card.suit] }}</span>
    </span>
  </component>
</template>
