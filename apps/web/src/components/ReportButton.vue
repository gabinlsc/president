<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { Bug, Send } from '@lucide/vue';
import { sendReport, type ReportResult } from '../lib/report';
import ModalDialog from './ModalDialog.vue';

const props = defineProps<{
  game: string;
  room?: string | undefined;
  phase?: string | undefined;
}>();

const TEXT: Record<ReportResult, string> = {
  sent: 'Merci ! Votre signalement est bien arrivé.',
  offline: 'Le signalement fonctionne sur la version en ligne.',
  too_many: 'Déjà plusieurs signalements : merci, on regarde.',
  invalid: 'Décrivez le problème en quelques mots.',
  error: 'Envoi impossible pour le moment, réessayez plus tard.',
};

const open = ref(false);
const text = ref('');
const busy = ref(false);
const result = ref<ReportResult | null>(null);
const area = ref<HTMLTextAreaElement | null>(null);

async function show(): Promise<void> {
  open.value = true;
  await nextTick();
  area.value?.focus();
}
function close(): void {
  open.value = false;
  if (result.value === 'sent') text.value = '';
  result.value = null;
}
async function submit(): Promise<void> {
  busy.value = true;
  result.value = await sendReport(props.game, text.value, { room: props.room, phase: props.phase });
  busy.value = false;
}
</script>

<template>
  <button
    type="button"
    class="btn-ghost fixed right-3 bottom-3 z-30 min-h-9 px-3 opacity-85 hover:opacity-100 focus-visible:opacity-100"
    aria-label="Signaler un bug"
    @click="show"
  >
    <Bug :size="16" /> <span class="hidden sm:inline">Un bug ?</span>
  </button>
  <ModalDialog v-if="open" title="Un bug ? Dites-nous tout" @close="close">
    <div class="space-y-3">
      <textarea
        ref="area"
        v-model="text"
        rows="5"
        maxlength="600"
        class="w-full rounded-2xl border-3 border-ink bg-paper px-4 py-3 text-base font-medium shadow-sm focus:bg-banana-soft focus:outline-none"
        placeholder="Que s’est-il passé ? Qu’attendiez-vous ?"
      />
      <p class="text-xs text-ink-soft">
        On joint le jeu, le code de la table et votre navigateur. Jamais votre adresse IP. ({{
          text.length
        }}/600)
      </p>
      <p
        v-if="result"
        class="rounded-xl border-2 border-ink bg-mint px-3 py-2 text-sm font-medium"
        role="status"
      >
        {{ TEXT[result] }}
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="close">
          {{ result === 'sent' ? 'Fermer' : 'Annuler' }}
        </button>
        <button
          v-if="result !== 'sent'"
          type="button"
          class="btn-primary"
          :disabled="busy || text.trim().length < 3"
          @click="submit"
        >
          <Send :size="16" /> Envoyer
        </button>
      </div>
    </div>
  </ModalDialog>
</template>
