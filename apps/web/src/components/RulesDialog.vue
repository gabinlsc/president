<script setup lang="ts">
import ModalDialog from './ModalDialog.vue';
defineEmits<{ close: [] }>();

const rules: readonly [string, string][] = [
  ['Valeurs', '3 < 4 < … < 10 < Valet < Dame < Roi < As < 2. 52 cartes, toutes distribuées.'],
  [
    'Ouverture',
    'Le détenteur de la Dame de cœur débute la première manche, avec la carte de son choix. Ensuite, le Trou du cul ouvre.',
  ],
  [
    'Format',
    'Un pli lancé en simples, paires ou triples se joue dans ce format, à valeur égale ou supérieure.',
  ],
  [
    'Même carte',
    'Poser la même valeur que le précédent oblige le suivant à la rejouer ou à passer. Une passe lève la contrainte.',
  ],
  ['Le 2', 'Il remporte le pli et nettoie la table. Son auteur relance.'],
  ['Dame de pique', 'Elle inverse immédiatement le sens de rotation.'],
  [
    'Couper',
    'Compléter un carré sur la table se fait même hors tour et nettoie la table. Toujours avec autant de cartes que le format du pli, jamais sur un pli lancé en triples ni sur ses propres cartes. Un carré complet peut aussi ouvrir le pli : il le ferme aussitôt. Le bouton « Couper » s’allume dès que vous pouvez fermer un carré.',
  ],
  [
    'Sorties',
    'Le premier qui finit (Président) arrête le pli. Les suivants sont simplement sautés.',
  ],
  ['Punition du 2', 'Finir sur un 2 rend Trou du cul d’office.'],
  [
    'Échanges',
    'Le Trou du cul donne ses 2 meilleures cartes au Président, qui en rend 2 de son choix. Idem pour 1 carte entre Vice-trouduc et Vice-président.',
  ],
];
</script>

<template>
  <ModalDialog title="Les règles du Président" @close="$emit('close')">
    <dl class="space-y-3 text-sm leading-relaxed">
      <div v-for="[term, text] in rules" :key="term" class="rounded-2xl bg-surface/60 p-3">
        <dt class="font-semibold text-moss">{{ term }}</dt>
        <dd class="text-ink-soft">{{ text }}</dd>
      </div>
    </dl>
  </ModalDialog>
</template>
