<script setup lang="ts">
import { computed } from 'vue';
import { SUIT_NAMES, SUIT_SYMBOLS, rankLabel, type Card } from '@president/shared';

const props = withDefaults(
  defineProps<{
    card?: Card | null;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    selected?: boolean;
    interactive?: boolean;
    playable?: boolean;
    /** Show the back: opponents' cards, or the first half of a deal flip. */
    faceDown?: boolean;
  }>(),
  {
    card: null,
    size: 'md',
    selected: false,
    interactive: false,
    playable: true,
    faceDown: false,
  },
);
defineEmits<{ select: [] }>();

const red = computed(() => props.card?.suit === 'hearts' || props.card?.suit === 'diamonds');
const label = computed(() =>
  props.card ? `${rankLabel(props.card.rank)} de ${SUIT_NAMES[props.card.suit]}` : 'Carte cachée',
);
const isFace = computed(() => !!props.card && props.card.rank >= 11 && props.card.rank <= 13);
const sizes = {
  xs: 'h-[2.6rem] w-[1.85rem] rounded-[6px] text-[0.55rem]',
  sm: 'h-[4.6rem] w-[3.3rem] rounded-lg text-[0.8rem]',
  md: 'h-[6.6rem] w-[4.7rem] rounded-xl text-base',
  lg: 'h-[8.4rem] w-[6rem] rounded-2xl text-xl',
} as const;
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    :aria-pressed="interactive ? selected : undefined"
    :aria-label="label"
    :data-card="card?.id"
    :data-rank="card?.rank"
    :data-suit="card?.suit"
    :data-playable="interactive ? playable : undefined"
    class="card-3d relative shrink-0 select-none"
    :class="[
      sizes[size],
      interactive ? 'transition-[translate,scale,filter] duration-200 ease-out' : '',
      interactive && !selected ? 'hover:-translate-y-3' : '',
      selected ? '-translate-y-6' : '',
      interactive && !playable && !selected ? 'brightness-[0.93] saturate-[0.55]' : '',
    ]"
    @click="interactive && $emit('select')"
  >
    <span
      class="card-inner rounded-[inherit]"
      :style="faceDown ? 'transform: rotateY(180deg)' : undefined"
    >
      <span
        class="card-face flex flex-col justify-between overflow-hidden border-ink p-[0.35em] font-bold"
        :class="[
          red ? 'text-heart' : 'text-ink',
          size === 'xs' ? 'border-2' : 'border-[2.5px]',
          selected
            ? 'bg-banana-soft shadow-[0_0_0_3px_var(--color-banana),0_0_0_5.5px_var(--color-ink),5px_5px_0_5px_var(--color-ink)]'
            : 'bg-paper shadow-[3px_3px_0_var(--color-ink)]',
        ]"
      >
        <template v-if="card">
          <span class="flex flex-col items-start leading-none" aria-hidden="true">
            <b class="font-display">{{ rankLabel(card.rank) }}</b>
            <span class="text-[0.85em]">{{ SUIT_SYMBOLS[card.suit] }}</span>
          </span>
          <span class="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span
              v-if="isFace"
              class="grid size-[58%] place-items-center rounded-[0.4em] border-2 border-current bg-current/10 font-display text-[1.7em]"
              >{{ rankLabel(card.rank) }}</span
            >
            <span v-else class="text-[2.1em]">{{ SUIT_SYMBOLS[card.suit] }}</span>
          </span>
          <span class="flex rotate-180 flex-col items-start leading-none" aria-hidden="true">
            <b class="font-display">{{ rankLabel(card.rank) }}</b>
            <span class="text-[0.85em]">{{ SUIT_SYMBOLS[card.suit] }}</span>
          </span>
        </template>
      </span>
      <span class="card-face card-back shadow-[2px_2px_0_var(--color-ink)]" aria-hidden="true">
        <span
          class="absolute inset-0 grid place-items-center font-display text-[1.5em] text-paper [-webkit-text-stroke:1.5px_var(--color-ink)] [paint-order:stroke]"
          >♠</span
        >
      </span>
    </span>
  </component>
</template>
