<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight, Gift, Scissors, Zap } from '@lucide/vue';
import { rankLabel } from '@president/shared';
import { useGameStore } from '../stores/game';
import { roleLabel } from '../lib/describe';
import PlayingCard from './PlayingCard.vue';

const store = useGameStore();
const game = computed(() => store.game!);
const playable = computed(() => new Set(game.value.legalPlays.flat()));
const reserved = computed(() => new Set(game.value.exchange?.reserved ?? []));
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

const hint = computed(() => {
  const g = game.value;
  if (g.phase === 'dealing') return 'Distribution en cours…';
  if (g.phase === 'exchanging') {
    const ex = g.exchange;
    if (!ex)
      return `Vous n’échangez rien cette manche. ${plural(g.pendingExchanges, 'choix')} en attente.`;
    const partner = store.nameOf(ex.partnerId);
    if (ex.forced)
      return `Vos ${plural(ex.give, 'meilleure carte')} partent automatiquement vers ${partner}.`;
    if (ex.submitted)
      return 'Choix validé. Les cartes changent de main dès que tout le monde est prêt.';
    return `Choisissez ${plural(ex.give, 'carte')} à donner à ${partner}.`;
  }
  if (g.phase !== 'playing') return '';
  if (store.self?.status === 'finished') return 'Vous avez terminé cette manche.';
  if (!store.isMyTurn)
    return g.legalPlays.length
      ? 'Vous pouvez couper : complétez le carré, même hors tour !'
      : `Au tour de ${store.nameOf(g.turn)}.`;
  if (!g.trick) return 'La table est à vous : ouvrez le pli.';
  if (g.trick.sameRankRequired)
    return `Même carte obligatoire : un ${rankLabel(g.trick.rank)}, ou passez.`;
  if (!g.legalPlays.length) return 'Aucune carte possible : passez.';
  const what = ['une carte', 'une paire', 'un triple'][g.trick.format - 1];
  return `Jouez ${what} de valeur ${rankLabel(g.trick.rank)} ou plus, ou passez.`;
});

const turnLabel = computed(() => {
  const g = game.value;
  if (g.phase === 'exchanging') return 'Échanges';
  if (g.phase === 'dealing') return 'Distribution';
  if (store.self?.status === 'finished') return 'Terminé';
  return store.isMyTurn ? 'C’est votre tour' : `Au tour de ${store.nameOf(g.turn)}`;
});
</script>

<template>
  <section
    class="glass-strong rounded-[2rem] p-4 transition sm:p-5"
    :class="store.isMyTurn ? 'hand-active' : ''"
    aria-label="Votre main"
  >
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid size-10 place-items-center rounded-full bg-moss font-semibold text-white">
          {{ store.self?.name.slice(0, 1).toUpperCase() }}
        </span>
        <span>
          <strong data-testid="self-name">{{ store.self?.name }}</strong>
          <span class="ml-1 text-xs text-ink-soft">vous</span>
          <span class="block text-xs text-ink-soft">{{
            store.self ? roleLabel(store.self.role) : ''
          }}</span>
        </span>
      </div>
      <span
        class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
        :class="
          store.isMyTurn
            ? 'bg-moss text-white shadow-[0_6px_16px_-6px_rgb(47_93_80/0.8)]'
            : 'bg-white/70 text-ink-soft'
        "
        data-testid="turn"
        :data-mine="store.isMyTurn"
        >{{ turnLabel }}</span
      >
    </header>

    <Transition name="fade">
      <p
        v-if="store.isMyTurn"
        class="mt-3 rounded-2xl bg-moss px-4 py-2 text-center text-sm font-semibold text-white shadow"
        role="status"
      >
        À vous de jouer !
      </p>
    </Transition>
    <div class="-mx-4 mt-3 overflow-x-auto px-4 pt-5 pb-2 sm:-mx-5 sm:px-5">
      <div
        :key="`round-${game.round}`"
        class="flex min-w-max justify-center -space-x-5 sm:-space-x-4"
        data-testid="hand"
      >
        <PlayingCard
          v-for="(card, i) in game.hand"
          :key="card.id"
          :card="card"
          :style="{ '--i': i }"
          interactive
          :selected="store.selected.includes(card.id)"
          :playable="game.phase !== 'playing' || playable.has(card.id)"
          :class="['deal-in', reserved.has(card.id) ? 'ring-2 ring-gold/70' : '']"
          @select="store.toggle(card.id)"
        />
      </div>
    </div>

    <footer class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p class="min-w-0 flex-1 text-sm text-ink-soft" data-testid="hint" aria-live="polite">
        {{ hint }}
        <button
          v-if="store.selected.length"
          type="button"
          class="ml-2 text-xs font-semibold text-moss underline-offset-2 hover:underline"
          @click="store.selected = []"
        >
          Effacer
        </button>
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="game.phase === 'playing' && store.self?.status !== 'finished'"
          type="button"
          class="btn min-h-11 border px-4"
          :class="
            store.availableCut
              ? 'cut-ready border-gold bg-gold text-white'
              : 'border-ink/10 bg-ink/5 text-ink-soft'
          "
          title="S’active dès que vous pouvez fermer un carré, à votre tour ou hors tour."
          :disabled="!store.availableCut || store.pending || !store.connected"
          data-testid="cut"
          @click="store.cut()"
        >
          <Zap :size="15" /> Couper
        </button>
        <template v-if="game.phase === 'exchanging'">
          <button
            v-if="game.exchange && !game.exchange.forced && !game.exchange.submitted"
            type="button"
            class="btn-primary"
            :disabled="!store.canExchange || store.pending || !store.connected"
            @click="store.exchange()"
          >
            <Gift :size="16" /> Donner mes cartes
          </button>
        </template>
        <template v-else-if="game.phase === 'playing'">
          <button
            type="button"
            class="btn-ghost"
            :disabled="!store.canPass || store.pending || !store.connected"
            @click="store.pass()"
          >
            Passer
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="!store.canPlay || store.pending || !store.connected"
            @click="store.play()"
          >
            <template v-if="store.isCut"><Scissors :size="16" /> Couper le carré</template>
            <template v-else>Jouer <ArrowRight :size="16" /></template>
          </button>
        </template>
      </div>
    </footer>
  </section>
</template>
