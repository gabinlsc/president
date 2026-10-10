<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight, Copy, Crown, Plus, Users } from '@lucide/vue';
import { MAX_PLAYERS, MIN_PLAYERS } from '@president/shared';
import { useGameStore } from '../stores/game';

const store = useGameStore();
const snapshot = computed(() => store.snapshot!);
const free = computed(() => Math.max(0, 4 - snapshot.value.members.length));

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(snapshot.value.code);
    store.toast('Code du salon copié.');
  } catch {
    store.toast(`Code du salon : ${snapshot.value.code}`);
  }
}
</script>

<template>
  <section
    class="glass mx-auto max-w-3xl rounded-[2rem] p-6 text-center sm:p-10"
    aria-labelledby="lobby-title"
  >
    <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-moss-soft text-moss"
      ><Users :size="26"
    /></span>
    <h2 id="lobby-title" class="mt-4 font-display text-3xl">Gardez une place pour vos amis.</h2>
    <p class="mt-2 text-ink-soft">Partagez ce code et retrouvez-vous à la même table.</p>
    <button
      type="button"
      class="mx-auto mt-5 flex items-center gap-3 rounded-2xl bg-white/80 px-6 py-3 font-mono text-3xl tracking-[0.35em] shadow-(--shadow-card) transition hover:bg-white"
      :aria-label="`Copier le code ${snapshot.code}`"
      data-testid="room-code"
      @click="copy"
    >
      {{ snapshot.code }} <Copy :size="18" class="text-ink-soft" />
    </button>

    <TransitionGroup name="fade" tag="ul" class="mt-8 grid gap-3 sm:grid-cols-2">
      <li
        v-for="member in snapshot.members"
        :key="member.id"
        class="flex items-center gap-3 rounded-2xl bg-white/70 p-3 text-left"
        data-testid="lobby-member"
      >
        <span class="grid size-10 place-items-center rounded-full bg-moss text-white">{{
          member.name.slice(0, 1).toUpperCase()
        }}</span>
        <span class="flex-1">
          <strong class="block">{{ member.name }}</strong>
          <span class="text-xs text-ink-soft">{{
            member.id === snapshot.hostId
              ? 'Hôte'
              : member.connected
                ? 'Prêt à jouer'
                : 'Déconnecté'
          }}</span>
        </span>
        <Crown v-if="member.id === snapshot.hostId" :size="18" class="text-gold" />
      </li>
      <li
        v-for="i in free"
        :key="`free-${i}`"
        class="flex items-center gap-3 rounded-2xl border border-dashed border-ink/15 p-3 text-left text-ink-soft"
      >
        <span class="grid size-10 place-items-center rounded-full bg-white/60"
          ><Plus :size="18"
        /></span>
        Place libre
      </li>
    </TransitionGroup>

    <div class="mt-8">
      <button
        v-if="store.isHost"
        type="button"
        class="btn-primary"
        :disabled="snapshot.members.length < MIN_PLAYERS || store.pending || !store.connected"
        @click="store.start()"
      >
        Lancer la partie <ArrowRight :size="17" />
      </button>
      <p v-else class="text-sm text-ink-soft">
        L’hôte lancera la partie quand tout le monde sera prêt.
      </p>
      <p class="mt-3 text-xs text-ink-soft">
        {{ snapshot.members.length }} / {{ MAX_PLAYERS }} joueurs · {{ MIN_PLAYERS }} minimum
      </p>
    </div>
  </section>
</template>
