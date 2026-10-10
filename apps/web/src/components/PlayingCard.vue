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
  xs: 'h-[2.6rem] w-[1.85rem] rounded-[5px] text-[0.55rem]',
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
      interactive && !playable && !selected ? 'brightness-[0.82] saturate-50' : '',
    ]"
    @click="interactive && $emit('select')"
  >
    <span
      class="card-inner rounded-[inherit]"
      :style="faceDown ? 'transform: rotateY(180deg)' : undefined"
    >
      <span
        class="card-face card-sheen flex flex-col justify-between overflow-hidden border bg-paper p-[0.35em] font-semibold"
        :class="[
          red ? 'text-[#b8323d]' : 'text-[#1c2522]',
          selected
            ? 'border-gold shadow-[0_0_0_2px_var(--color-gold),var(--shadow-lift)]'
            : 'border-black/5 shadow-(--shadow-card)',
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
              class="grid size-[58%] place-items-center rounded-[0.4em] border border-current/20 bg-current/5 font-display text-[1.7em]"
              >{{ rankLabel(card.rank) }}</span
            >
            <span v-else class="text-[2.1em] drop-shadow-sm">{{ SUIT_SYMBOLS[card.suit] }}</span>
          </span>
          <span class="flex rotate-180 flex-col items-start leading-none" aria-hidden="true">
            <b class="font-display">{{ rankLabel(card.rank) }}</b>
            <span class="text-[0.85em]">{{ SUIT_SYMBOLS[card.suit] }}</span>
          </span>
        </template>
      </span>
      <span class="card-face card-back shadow-(--shadow-card)" aria-hidden="true">
        <span class="absolute inset-0 grid place-items-center text-[1.4em] text-champagne/70"
          >♠</span
        >
      </span>
    </span>
  </component>
</template>
