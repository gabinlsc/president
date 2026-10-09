<script setup lang="ts">
import type { Card } from '@president/shared';
import { rankLabel, SUITS } from '@president/shared';
defineProps<{
  card: Card;
  selected?: boolean;
  interactive?: boolean;
  small?: boolean;
  index?: number;
}>();
defineEmits<{ select: [] }>();
</script>
<template>
  <button
    v-if="interactive"
    type="button"
    class="playing-card"
    :data-rank="card.rank"
    :data-suit="card.suit"
    :class="[{ red: card.suit === 'hearts' || card.suit === 'diamonds', selected, small }]"
    :style="{ '--i': index ?? 0 }"
    :aria-pressed="!!selected"
    :aria-label="`${rankLabel(card.rank)} de ${{ hearts: 'cœur', spades: 'pique', diamonds: 'carreau', clubs: 'trèfle' }[card.suit]}`"
    @click="$emit('select')"
  >
    <span class="card-corner"
      ><b>{{ rankLabel(card.rank) }}</b
      ><span>{{ SUITS[card.suit] }}</span></span
    ><span class="card-symbol" aria-hidden="true">{{ SUITS[card.suit] }}</span
    ><span class="card-corner bottom" aria-hidden="true"
      ><b>{{ rankLabel(card.rank) }}</b
      ><span>{{ SUITS[card.suit] }}</span></span
    >
  </button>
  <div
    v-else
    class="playing-card"
    :data-rank="card.rank"
    :data-suit="card.suit"
    :class="[{ red: card.suit === 'hearts' || card.suit === 'diamonds', small }]"
    :style="{ '--i': index ?? 0 }"
    :aria-label="`${rankLabel(card.rank)} ${SUITS[card.suit]}`"
  >
    <span class="card-corner"
      ><b>{{ rankLabel(card.rank) }}</b
      ><span>{{ SUITS[card.suit] }}</span></span
    ><span class="card-symbol" aria-hidden="true">{{ SUITS[card.suit] }}</span
    ><span class="card-corner bottom" aria-hidden="true"
      ><b>{{ rankLabel(card.rank) }}</b
      ><span>{{ SUITS[card.suit] }}</span></span
    >
  </div>
</template>
