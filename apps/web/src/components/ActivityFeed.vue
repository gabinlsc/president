<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';

const store = useGameStore();
const lines = computed(() => [...store.log].reverse().slice(0, 8));
</script>

<template>
  <aside class="glass rounded-3xl p-5" aria-label="Le fil de la partie">
    <p class="eyebrow">Le fil de la partie</p>
    <TransitionGroup
      name="log"
      tag="ol"
      class="mt-3 space-y-2 text-sm"
      aria-live="polite"
      aria-relevant="additions"
    >
      <li v-for="line in lines" :key="line.id" class="flex gap-2 text-ink-soft first:text-ink">
        <span class="mt-2 size-1.5 shrink-0 rounded-full bg-moss/60" />{{ line.text }}
      </li>
    </TransitionGroup>
    <p v-if="!lines.length" class="mt-3 text-sm text-ink-soft">La partie commence…</p>
  </aside>
</template>
