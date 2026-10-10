<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowRight, Bot, Minus, Plus, Users } from '@lucide/vue';
import { MAX_SOLO_BOTS, MIN_SOLO_BOTS, NAME_MAX_LENGTH, type Card } from '@president/shared';
import { useGameStore } from '../stores/game';
import { storage } from '../lib/storage';
import ModalDialog from './ModalDialog.vue';
import PlayingCard from './PlayingCard.vue';

const store = useGameStore();
const bots = ref(MIN_SOLO_BOTS);
const code = ref('');
const name = ref(storage.name());
const intent = ref<'solo' | 'online' | 'join' | null>(null);

const showcase: Card[] = [
  { id: '14-clubs', rank: 14, suit: 'clubs' },
  { id: '12-hearts', rank: 12, suit: 'hearts' },
  { id: '15-spades', rank: 15, suit: 'spades' },
];
const disabled = computed(() => !store.connected || store.pending);
const titles = {
  solo: 'Une partie en solo',
  online: 'Créer une table',
  join: 'Rejoindre la table',
} as const;

async function submit(): Promise<void> {
  const mode = intent.value;
  if (!mode) return;
  const ok =
    mode === 'join'
      ? await store.join({ code: code.value, name: name.value })
      : await store.create(
          mode === 'solo'
            ? { mode, name: name.value, bots: bots.value }
            : { mode, name: name.value },
        );
  if (ok) intent.value = null;
}
</script>

<template>
  <main class="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
    <section class="grid grid-cols-1 items-center gap-10 py-10 md:grid-cols-[1.1fr_1fr] md:py-16">
      <div>
        <p class="eyebrow">Le grand classique, rebattu</p>
        <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-6xl">
          Une bonne main.<br />Une <em class="text-moss">meilleure</em> compagnie.
        </h1>
        <p class="mt-5 max-w-md text-ink-soft">
          Le Président en temps réel : entre amis avec un code de table, ou face à des bots qui
          prennent le temps de réfléchir.
        </p>
      </div>
      <div
        class="glass relative mx-auto flex h-64 w-full max-w-sm items-center justify-center rounded-[2rem]"
        aria-hidden="true"
      >
        <div class="flex -space-x-6">
          <PlayingCard
            v-for="(card, i) in showcase"
            :key="card.id"
            :card="card"
            size="lg"
            :class="
              ['-rotate-12 translate-y-2', 'z-10 -translate-y-2', 'rotate-12 translate-y-2'][i]
            "
          />
        </div>
        <span class="absolute bottom-4 text-xs text-ink-soft"
          >52 cartes. Une seule présidence.</span
        >
      </div>
    </section>

    <section aria-labelledby="choose-title">
      <h2 id="choose-title" class="font-display text-2xl sm:text-3xl">On se fait une partie ?</h2>
      <div class="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <article class="glass flex min-w-0 flex-col gap-5 rounded-3xl p-6">
          <div class="flex items-center justify-between">
            <span class="grid size-11 place-items-center rounded-2xl bg-moss-soft text-moss"
              ><Bot :size="22"
            /></span>
            <span class="eyebrow">À votre rythme</span>
          </div>
          <div>
            <h3 class="font-display text-2xl">En solo</h3>
            <p class="mt-1 text-sm text-ink-soft">
              Des bots patients qui coupent, inversent et gardent leurs 2.
            </p>
          </div>
          <div
            class="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-2.5 text-sm"
          >
            <span>Adversaires bots</span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="grid size-8 place-items-center rounded-full bg-white shadow-sm disabled:opacity-40"
                aria-label="Un bot de moins"
                :disabled="bots <= MIN_SOLO_BOTS"
                @click="bots--"
              >
                <Minus :size="14" />
              </button>
              <output class="w-4 text-center font-semibold" aria-live="polite">{{ bots }}</output>
              <button
                type="button"
                class="grid size-8 place-items-center rounded-full bg-white shadow-sm disabled:opacity-40"
                aria-label="Un bot de plus"
                :disabled="bots >= MAX_SOLO_BOTS"
                @click="bots++"
              >
                <Plus :size="14" />
              </button>
            </div>
          </div>
          <button
            type="button"
            class="btn-primary mt-auto"
            :disabled="disabled"
            @click="intent = 'solo'"
          >
            Jouer en solo <ArrowRight :size="17" />
          </button>
        </article>

        <article class="glass flex min-w-0 flex-col gap-5 rounded-3xl p-6">
          <div class="flex items-center justify-between">
            <span class="grid size-11 place-items-center rounded-2xl bg-blush text-heart"
              ><Users :size="22"
            /></span>
            <span class="eyebrow">De 2 à 8 joueurs</span>
          </div>
          <div>
            <h3 class="font-display text-2xl">Entre amis</h3>
            <p class="mt-1 text-sm text-ink-soft">
              Une table privée, un code à quatre caractères à partager.
            </p>
          </div>
          <button type="button" class="btn-ghost" :disabled="disabled" @click="intent = 'online'">
            Créer une table <Plus :size="17" />
          </button>
          <form class="mt-auto flex gap-2" @submit.prevent="intent = 'join'">
            <label class="sr-only" for="room-code">Code du salon</label>
            <input
              id="room-code"
              v-model="code"
              class="min-w-0 flex-1 rounded-full border border-white/80 bg-white/70 px-4 text-sm tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:normal-case focus:outline-moss"
              size="8"
              maxlength="4"
              pattern="[A-Fa-f0-9]{4}"
              placeholder="Code du salon"
              autocomplete="off"
              required
            />
            <button type="submit" class="btn-ghost" :disabled="disabled || code.length !== 4">
              Rejoindre <ArrowRight :size="16" />
            </button>
          </form>
        </article>
      </div>
    </section>

    <ModalDialog v-if="intent" :title="titles[intent]" @close="intent = null">
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block text-sm font-medium" for="player-name">Votre pseudo</label>
        <input
          id="player-name"
          v-model="name"
          class="w-full rounded-2xl border border-white bg-white/80 px-4 py-3 focus:outline-moss"
          :maxlength="NAME_MAX_LENGTH"
          autocomplete="nickname"
          required
        />
        <p v-if="store.error" class="text-sm text-heart" role="alert">{{ store.error }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="disabled || !name.trim()">
          {{ intent === 'join' ? 'Prendre place' : 'C’est parti' }} <ArrowRight :size="17" />
        </button>
      </form>
    </ModalDialog>
  </main>
</template>
