<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeft, BookOpen, Check, Crown, LogOut, Moon, Sun, WifiOff } from '@lucide/vue';
import { theme, toggleTheme } from './lib/theme';
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
        class="flex items-center gap-2 font-display text-lg"
        aria-label="Le Président, accueil"
        @click="store.snapshot ? (confirmLeave = true) : undefined"
      >
        <span class="glass grid size-9 place-items-center rounded-xl text-gold"
          ><Crown :size="18"
        /></span>
        le président<span class="text-moss">.</span>
      </button>
      <nav class="flex items-center gap-2 text-sm" aria-label="Navigation principale">
        <button
          type="button"
          class="btn-ghost min-h-9 px-3"
          :aria-label="theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'"
          data-testid="theme-toggle"
          @click="toggleTheme"
        >
          <Transition name="fade" mode="out-in">
            <Sun v-if="theme === 'dark'" key="sun" :size="15" />
            <Moon v-else key="moon" :size="15" />
          </Transition>
        </button>
        <button type="button" class="btn-ghost min-h-9 px-3" @click="showRules = true">
          <BookOpen :size="15" /> Les règles
        </button>
        <span
          class="glass hidden items-center gap-2 rounded-full px-3 py-2 text-xs text-ink-soft sm:flex"
          role="status"
        >
          <span
            class="size-2 rounded-full"
            :class="store.connected ? 'bg-moss' : 'animate-pulse bg-gold'"
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
          class="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
          @click="confirmLeave = true"
        >
          <ArrowLeft :size="15" /> Quitter la table
        </button>
        <span class="eyebrow">{{
          store.snapshot?.mode === 'solo' ? 'Table solo' : `Table ${store.snapshot?.code}`
        }}</span>
      </div>
      <Transition name="fade" mode="out-in">
        <LobbyView v-if="view === 'lobby'" key="lobby" />
        <ResultsPanel v-else-if="view === 'results'" key="results" />
        <GameTable v-else key="table" />
      </Transition>
    </main>

    <footer class="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-ink-soft sm:px-6">
      Fait pour les bonnes compagnies · ♣ ♦ ♠ ♥
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
        <button type="button" class="btn-primary" :disabled="store.pending" @click="leave">
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
          class="glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          role="status"
        >
          <WifiOff :size="16" /> Connexion interrompue. Retour à la table…
        </div>
      </Transition>
      <Transition name="fade">
        <div
          v-if="store.notice"
          class="glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          role="status"
        >
          <Check :size="16" class="text-moss" /> {{ store.notice }}
        </div>
      </Transition>
      <Transition name="fade">
        <div
          v-if="store.error && view !== 'home'"
          class="pointer-events-auto flex items-center gap-3 rounded-full bg-heart/90 px-4 py-2 text-sm text-sand shadow-lg backdrop-blur"
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
