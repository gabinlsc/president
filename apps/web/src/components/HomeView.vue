<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { ArrowRight, Bot, Minus, Plus, Users } from '@lucide/vue';
import { MAX_SOLO_BOTS, MIN_SOLO_BOTS, NAME_MAX_LENGTH, type Card } from '@president/shared';
import { useGameStore } from '../stores/game';
import { storage } from '../lib/storage';
import { installState, onInstallChange, promptInstall } from '../lib/pwa';
import ModalDialog from './ModalDialog.vue';
import PlayingCard from './PlayingCard.vue';
import DecorShapes from './DecorShapes.vue';

const store = useGameStore();
const bots = ref(MIN_SOLO_BOTS);
const code = ref('');
const name = ref(storage.name());
const intent = ref<'solo' | 'online' | 'join' | null>(null);

const install = ref(installState());
const iosHint = ref(false);
const stopInstall = onInstallChange(() => (install.value = installState()));
onBeforeUnmount(stopInstall);
function installApp() {
  if (install.value.canPrompt) void promptInstall();
  else iosHint.value = !iosHint.value;
}

const showcase: Card[] = [
  { id: '14-clubs', rank: 14, suit: 'clubs' },
  { id: '12-hearts', rank: 12, suit: 'hearts' },
  { id: '15-spades', rank: 15, suit: 'spades' },
];
/** Sticker colours for the bots around the solo table. */
const BOT_COLORS = ['bg-sky', 'bg-lilac', 'bg-peach', 'bg-mint', 'bg-coral', 'bg-banana', 'bg-sky'];
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
  <main class="relative mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
    <DecorShapes />
    <section
      class="relative grid grid-cols-1 items-center gap-10 py-8 md:grid-cols-[1.1fr_1fr] md:py-14"
    >
      <div>
        <p class="pill -rotate-2 bg-sky shadow-sm">♠ Jeu de cartes · 2 à 8 joueurs</p>
        <h1 class="mt-5 font-display text-5xl leading-[1.02] font-bold sm:text-7xl">
          Une bonne main.<br />Une
          <span
            class="inline-block -rotate-2 rounded-xl border-3 border-ink bg-banana px-2 shadow-md"
            >meilleure</span
          >
          compagnie.
        </h1>
        <p class="mt-6 max-w-md text-lg text-ink-soft">
          Le Président en temps réel : entre amis avec un code de table, ou face à des bots qui
          prennent le temps de réfléchir.
        </p>
      </div>
      <div
        class="felt relative mx-auto grid h-72 w-full max-w-md rotate-1 place-items-center rounded-[50%] sm:h-80"
        aria-hidden="true"
      >
        <div class="relative h-40 w-64">
          <span
            v-for="(card, i) in showcase"
            :key="card.id"
            class="float-card absolute top-0 left-1/2 -ml-12"
            :style="{
              '--r': `${(i - 1) * 14}deg`,
              '--d': `${i * 0.6}s`,
              translate: `${(i - 1) * 74}px ${Math.abs(i - 1) * 14}px`,
              zIndex: i === 1 ? 2 : 1,
            }"
          >
            <PlayingCard :card="card" size="lg" />
          </span>
        </div>
        <span class="pill absolute bottom-7 rotate-2 bg-paper shadow-sm"
          >52 cartes · une seule présidence</span
        >
      </div>
    </section>

    <section aria-labelledby="choose-title" class="relative">
      <h2 id="choose-title" class="font-display text-3xl font-bold sm:text-4xl">
        On se fait une partie ?
      </h2>
      <div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <article
          class="panel-lg flex min-w-0 flex-col gap-5 rounded-3xl p-6 transition-transform duration-200 ease-(--ease-spring) md:-rotate-1 md:hover:rotate-0"
        >
          <div class="flex items-center justify-between gap-3">
            <span
              class="grid size-12 -rotate-6 place-items-center rounded-2xl border-3 border-ink bg-mint shadow-sm"
              ><Bot :size="24" :stroke-width="2.4"
            /></span>
            <span class="eyebrow">À votre rythme</span>
          </div>
          <div>
            <h3 class="font-display text-3xl font-bold">En solo</h3>
            <p class="mt-1 text-ink-soft">
              Des bots patients qui coupent, inversent et gardent leurs 2.
            </p>
          </div>
          <div class="rounded-2xl border-3 border-ink bg-mint-soft p-4">
            <div class="flex items-center justify-between gap-3">
              <span class="font-display font-semibold">Adversaires bots</span>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="btn size-9 min-h-0 px-0"
                  aria-label="Un bot de moins"
                  :disabled="bots <= MIN_SOLO_BOTS"
                  @click="bots--"
                >
                  <Minus :size="16" :stroke-width="3" />
                </button>
                <output
                  class="w-6 text-center font-display text-2xl font-bold"
                  aria-live="polite"
                  >{{ bots }}</output
                >
                <button
                  type="button"
                  class="btn size-9 min-h-0 px-0"
                  aria-label="Un bot de plus"
                  :disabled="bots >= MAX_SOLO_BOTS"
                  @click="bots++"
                >
                  <Plus :size="16" :stroke-width="3" />
                </button>
              </div>
            </div>
            <ul class="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
              <li
                v-for="i in MAX_SOLO_BOTS"
                :key="i"
                class="grid size-8 place-items-center rounded-lg border-2 transition-all duration-200 ease-(--ease-spring)"
                :class="
                  i <= bots
                    ? [BOT_COLORS[i - 1], 'border-ink shadow-sm', i % 2 ? '-rotate-6' : 'rotate-6']
                    : 'scale-90 border-dashed border-ink/30'
                "
              >
                <Bot v-if="i <= bots" :size="16" :stroke-width="2.4" />
              </li>
            </ul>
            <p class="mt-2 text-xs font-medium text-ink-soft">
              {{ bots + 1 }} joueurs autour de la table, vous compris.
            </p>
          </div>
          <button
            type="button"
            class="btn-primary mt-auto"
            :disabled="disabled"
            @click="intent = 'solo'"
          >
            Jouer en solo <ArrowRight :size="18" :stroke-width="2.6" />
          </button>
        </article>

        <article
          class="panel-lg flex min-w-0 flex-col gap-5 rounded-3xl p-6 transition-transform duration-200 ease-(--ease-spring) md:rotate-1 md:hover:rotate-0"
        >
          <div class="flex items-center justify-between gap-3">
            <span
              class="grid size-12 rotate-6 place-items-center rounded-2xl border-3 border-ink bg-coral shadow-sm"
              ><Users :size="24" :stroke-width="2.4"
            /></span>
            <span class="eyebrow">De 2 à 8 joueurs</span>
          </div>
          <div>
            <h3 class="font-display text-3xl font-bold">Entre amis</h3>
            <p class="mt-1 text-ink-soft">
              Une table privée, un code à quatre caractères à partager.
            </p>
          </div>
          <button type="button" class="btn-go" :disabled="disabled" @click="intent = 'online'">
            Créer une table <Plus :size="18" :stroke-width="2.6" />
          </button>
          <div
            class="flex items-center gap-3 text-xs font-semibold text-ink-soft"
            aria-hidden="true"
          >
            <span class="h-0.5 flex-1 bg-ink/15" /> ou <span class="h-0.5 flex-1 bg-ink/15" />
          </div>
          <form class="mt-auto flex gap-2" @submit.prevent="intent = 'join'">
            <label class="sr-only" for="room-code">Code du salon</label>
            <input
              id="room-code"
              v-model="code"
              class="min-w-0 flex-1 rounded-full border-3 border-ink bg-paper px-4 font-display text-base font-semibold tracking-[0.25em] uppercase shadow-sm placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:normal-case focus:bg-banana-soft focus:outline-none"
              size="8"
              maxlength="4"
              pattern="[A-Fa-f0-9]{4}"
              placeholder="Code du salon"
              autocomplete="off"
              required
            />
            <button type="submit" class="btn-ghost" :disabled="disabled || code.length !== 4">
              Rejoindre <ArrowRight :size="16" :stroke-width="2.6" />
            </button>
          </form>
        </article>
      </div>
    </section>

    <ModalDialog v-if="intent" :title="titles[intent]" @close="intent = null">
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block font-display font-semibold" for="player-name">Votre pseudo</label>
        <input
          id="player-name"
          v-model="name"
          class="w-full rounded-2xl border-3 border-ink bg-paper px-4 py-3 text-base font-medium shadow-sm focus:bg-banana-soft focus:outline-none"
          :maxlength="NAME_MAX_LENGTH"
          autocomplete="nickname"
          required
        />
        <p
          v-if="store.error"
          class="rounded-xl border-2 border-ink bg-coral/40 px-3 py-2 text-sm font-medium"
          role="alert"
        >
          {{ store.error }}
        </p>
        <button type="submit" class="btn-primary w-full" :disabled="disabled || !name.trim()">
          {{ intent === 'join' ? 'Prendre place' : 'C’est parti' }}
          <ArrowRight :size="18" :stroke-width="2.6" />
        </button>
      </form>
    </ModalDialog>

    <p v-if="install.canPrompt || install.ios" class="mt-6 text-center">
      <button type="button" class="btn-ghost" @click="installApp">Installer l’appli</button>
      <span v-if="iosHint && install.ios" role="status" class="mt-2 block text-sm font-medium">
        Touche « Partager » puis « Sur l’écran d’accueil ».
      </span>
    </p>
  </main>
</template>
