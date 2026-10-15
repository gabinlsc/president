<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeft, BookOpen, Check, Crown, Gamepad2, LogOut, WifiOff } from '@lucide/vue';
import { useGameStore } from './stores/game';
import GameTable from './components/GameTable.vue';
import HomeView from './components/HomeView.vue';
import LobbyView from './components/LobbyView.vue';
import ModalDialog from './components/ModalDialog.vue';
import ResultsPanel from './components/ResultsPanel.vue';
import RulesDialog from './components/RulesDialog.vue';

const store = useGameStore();
const showRules = ref(false);
const confirmLeave = ref(false);
const phase = computed(() => store.game?.phase ?? null);
const view = computed(() => {
  if (!store.snapshot || !phase.value) return 'home';
  if (phase.value === 'lobby') return 'lobby';
  return phase.value === 'roundOver' ? 'results' : 'table';
});

async function leave(): Promise<void> {
  if (await store.leave()) confirmLeave.value = false;
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header
      class="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"
    >
      <button
        type="button"
        class="group flex items-center gap-2.5 font-display text-xl font-bold"
        aria-label="Le Président, accueil"
        @click="store.snapshot ? (confirmLeave = true) : undefined"
      >
        <span
          class="grid size-10 -rotate-6 place-items-center rounded-xl border-3 border-ink bg-banana shadow-sm transition-transform duration-200 ease-(--ease-spring) group-hover:rotate-6"
          ><Crown :size="20" :stroke-width="2.5"
        /></span>
        <span class="hidden sm:inline">Le Président</span>
      </button>
      <nav class="flex items-center gap-2 text-sm" aria-label="Navigation principale">
        <a
          href="https://games.glsc.fr"
          class="btn-ghost min-h-9 px-3"
          aria-label="Retour à la salle de jeux"
        >
          <Gamepad2 :size="16" /> <span class="hidden sm:inline">Salle de jeux</span>
        </a>
        <button type="button" class="btn-ghost min-h-9 px-3" @click="showRules = true">
          <BookOpen :size="16" /> Les règles
        </button>
        <span
          class="panel hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex"
          role="status"
        >
          <span
            class="size-2.5 rounded-full border-2 border-ink"
            :class="store.connected ? 'bg-mint' : 'animate-pulse bg-banana'"
          />
          {{ store.connected ? 'Connecté' : 'Connexion…' }}
        </span>
      </nav>
    </header>

    <HomeView v-if="view === 'home'" />
    <main v-else class="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 sm:px-6">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="flex items-center gap-1 font-display text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          @click="confirmLeave = true"
        >
          <ArrowLeft :size="15" /> Quitter la table
        </button>
        <span class="pill bg-paper shadow-sm">{{
          store.snapshot?.mode === 'solo' ? 'Table solo' : `Table ${store.snapshot?.code}`
        }}</span>
      </div>
      <Transition name="fade" mode="out-in">
        <LobbyView v-if="view === 'lobby'" key="lobby" />
        <ResultsPanel v-else-if="view === 'results'" key="results" />
        <GameTable v-else key="table" />
      </Transition>
    </main>

    <footer
      class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs font-medium text-ink-soft sm:px-6"
    >
      <span>Fait pour les bonnes compagnies · ♣ ♦ ♠ ♥</span>
      <a href="https://glsc.fr" class="underline underline-offset-4 hover:text-ink"
        >Un jeu de glsc.fr</a
      >
    </footer>

    <RulesDialog v-if="showRules" @close="showRules = false" />
    <ModalDialog v-if="confirmLeave" title="Quitter la table ?" @close="confirmLeave = false">
      <p class="text-sm text-ink-soft">
        {{
          phase === 'lobby'
            ? 'Votre place sera libérée.'
            : 'Un bot reprendra vos cartes jusqu’à la fin de la partie.'
        }}
      </p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="confirmLeave = false">Rester</button>
        <button type="button" class="btn-danger" :disabled="store.pending" @click="leave">
          <LogOut :size="16" /> Quitter
        </button>
      </div>
    </ModalDialog>

    <div
      class="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-4"
    >
      <Transition name="fade">
        <div
          v-if="!store.connected && store.snapshot"
          class="panel flex items-center gap-2 rounded-full bg-banana px-4 py-2 text-sm font-semibold"
          role="status"
        >
          <WifiOff :size="16" /> Connexion interrompue. Retour à la table…
        </div>
      </Transition>
      <Transition name="fade">
        <div
          v-if="store.notice"
          class="panel flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
          role="status"
        >
          <span class="grid size-5 place-items-center rounded-full border-2 border-ink bg-mint"
            ><Check :size="12" :stroke-width="3"
          /></span>
          {{ store.notice }}
        </div>
      </Transition>
      <Transition name="fade">
        <div
          v-if="store.error && view !== 'home'"
          class="panel pointer-events-auto flex items-center gap-3 rounded-full bg-coral px-4 py-2 text-sm font-semibold"
          role="alert"
          data-testid="error"
        >
          {{ store.error }}
          <button type="button" class="font-semibold underline" @click="store.error = ''">
            OK
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>
