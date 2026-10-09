<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import {
  Crown,
  ArrowUpRight,
  ArrowRight,
  Users,
  Bot,
  Copy,
  Check,
  ArrowLeft,
  Plus,
  Minus,
  Spade,
  Heart,
  Wifi,
  WifiOff,
  X,
  BookOpen,
  LogOut,
  RefreshCw,
  ChevronRight,
} from '@lucide/vue';
import type { Card } from '@president/shared';
import { roleLabel } from '@president/shared';
import { useGame } from './useGame';
import PlayingCard from './components/PlayingCard.vue';
const { room, connected, pending, error, notice, self, isHost, isTurn, command, toast } = useGame();
const bots = ref(4),
  joinCode = ref(''),
  selected = ref<string[]>([]),
  showRules = ref(false),
  modal = ref<'solo' | 'online' | 'join' | null>(null),
  showLeave = ref(false);
const name = ref('');
try {
  name.value = localStorage.getItem('president-name') ?? '';
} catch {
  /* optional storage */
}
const nameInput = ref<HTMLInputElement | null>(null),
  dialog = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;
const modalOpen = computed(() => !!modal.value || showRules.value || showLeave.value);
watch(modalOpen, async (open) => {
  if (open) {
    previousFocus = document.activeElement as HTMLElement;
    await nextTick();
    (nameInput.value ?? dialog.value?.querySelector<HTMLElement>('button,input'))?.focus();
  } else previousFocus?.focus();
});
const others = computed(() => room.value?.players.filter((p) => p.id !== room.value?.selfId) ?? []);
const turnName = computed(
  () => room.value?.players.find((p) => p.id === room.value?.turn)?.name ?? '',
);
const selectedCards = computed(
  () => room.value?.hand.filter((c) => selected.value.includes(c.id)) ?? [],
);
const canCut = computed(() => {
  const t = room.value?.table,
    c = selectedCards.value;
  return (
    !!t &&
    t.format !== 3 &&
    c.length > 0 &&
    t.run.length + c.length === 4 &&
    c.every((x) => x.rank === t.rank)
  );
});
const canPlay = computed(() => {
  const r = room.value,
    c = selectedCards.value,
    t = r?.table;
  if (!r || r.phase !== 'playing' || !c.length || !c.every((x) => x.rank === c[0]!.rank))
    return false;
  if (r.opening && !c.some((x) => x.id === '12-hearts')) return false;
  if (canCut.value) return true;
  return (
    isTurn.value &&
    c.length <= 3 &&
    (!t ||
      (c.length === t.format && (t.equalRequired ? c[0]!.rank === t.rank : c[0]!.rank >= t.rank)))
  );
});
const canExchange = computed(
  () =>
    room.value?.phase === 'exchange' &&
    !room.value.exchangeSubmitted &&
    room.value.exchangeCount > 0 &&
    selected.value.length === room.value.exchangeCount,
);
const selectionHint = computed(() => {
  const r = room.value;
  if (!r) return '';
  if (r.phase === 'exchange')
    return r.exchangeCount && !r.exchangeSubmitted
      ? `Choisissez ${r.exchangeCount} carte${r.exchangeCount > 1 ? 's' : ''} à donner.`
      : 'Les cartes sont échangées dès que les choix sont prêts.';
  if (r.opening && isTurn.value) return 'Ouvrez avec la Dame de cœur.';
  if (r.table?.equalRequired && isTurn.value) return 'Même valeur obligatoire, ou passez.';
  if (isTurn.value)
    return r.table
      ? `Jouez ${r.table.format === 1 ? 'une carte' : r.table.format === 2 ? 'une paire' : 'un triple'} de valeur supérieure ou égale.`
      : 'La table est à vous. Ouvrez le pli.';
  return 'Vous pouvez compléter un carré, même hors tour.';
});
const demoCards: Card[] = [
  { id: 'a', rank: 14, suit: 'clubs' },
  { id: 'q', rank: 12, suit: 'hearts' },
  { id: 'k', rank: 13, suit: 'spades' },
];
watch(
  () => room.value?.hand.map((c) => c.id).join(','),
  () => {
    selected.value = selected.value.filter((id) => room.value?.hand.some((c) => c.id === id));
  },
);
watch(
  () => room.value?.phase,
  () => {
    selected.value = [];
  },
);
function toggle(id: string) {
  if (pending.value) return;
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id];
}
async function enter() {
  if (!modal.value) return;
  const mode = modal.value;
  const ok =
    mode === 'join'
      ? await command('room:join', { name: name.value, code: joinCode.value })
      : await command('room:create', { name: name.value, mode, bots: bots.value });
  if (ok) {
    try {
      localStorage.setItem('president-name', name.value.trim());
    } catch {
      /* optional */
    }
    modal.value = null;
    selected.value = [];
  }
}
async function play() {
  if (
    await command(room.value?.phase === 'exchange' ? 'game:exchange' : 'game:play', {
      cards: selected.value,
    })
  )
    selected.value = [];
}
async function leave() {
  if (await command('room:leave')) {
    showLeave.value = false;
    selected.value = [];
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(room.value!.code);
    toast('Code du salon copié.');
  } catch {
    toast(`Code du salon : ${room.value!.code}`);
  }
}
function keyboard(e: KeyboardEvent) {
  if (!modalOpen.value) return;
  if (e.key === 'Escape' && !pending.value) {
    modal.value = null;
    showRules.value = false;
    showLeave.value = false;
  }
  if (e.key === 'Tab' && dialog.value) {
    const elements = Array.from(
      dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]'),
    );
    const first = elements[0],
      last = elements.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
}
document.addEventListener('keydown', keyboard);
onBeforeUnmount(() => document.removeEventListener('keydown', keyboard));
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a
        class="brand"
        href="/"
        @click.prevent="room ? (showLeave = true) : undefined"
        aria-label="Le Président, accueil"
        ><span class="brand-mark"><Crown :size="23" :stroke-width="1.7" /></span
        ><span>le président<span class="brand-dot">.</span></span></a
      >
      <nav aria-label="Navigation principale">
        <button class="nav-link" @click="showRules = true">
          <BookOpen :size="16" /> Les règles</button
        ><span class="nav-separator"></span
        ><span class="connection" :class="{ offline: !connected }"
          ><span class="status-dot"></span
          >{{ connected ? 'La table est ouverte' : 'Connexion en cours' }}</span
        >
      </nav>
    </header>

    <main v-if="!room" class="home">
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow"><span class="tiny-line"></span> LE GRAND CLASSIQUE, REBATTU.</div>
          <h1>Une bonne main.<br />Une <em>meilleure</em><br />compagnie.</h1>
          <p>
            De la première carte au dernier sourire.<br />Retrouvez le Président, entre amis ou face
            aux bots.
          </p>
          <div class="hero-meta">
            <div class="avatar-stack"><span>G</span><span>C</span><span>L</span></div>
            <span>Un jeu de cartes. Beaucoup de caractère.</span>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span>
          <div class="art-label"><span class="status-dot"></span> TOUT LE MONDE A SA PLACE</div>
          <div class="floating-suit suit-one">♣</div>
          <div class="floating-suit suit-two">♦</div>
          <div class="hero-cards">
            <PlayingCard v-for="(card, i) in demoCards" :key="card.id" :card="card" :index="i" />
          </div>
          <div class="crown-sticker">
            <Crown :size="30" :stroke-width="1.6" /><span>À vous<br />la couronne.</span>
          </div>
          <span class="art-caption">52 cartes. Une seule présidence.</span>
        </div>
      </section>
      <section class="choose-section" aria-labelledby="choose-title">
        <div class="section-heading">
          <h2 id="choose-title">On se fait une partie ?</h2>
          <span>Choisissez votre table <ArrowRight :size="17" /></span>
        </div>
        <div class="mode-grid">
          <article class="mode-card solo-card">
            <div class="mode-top">
              <span class="mode-icon"><Bot :size="24" :stroke-width="1.5" /></span
              ><span class="pill">À VOTRE RYTHME</span>
            </div>
            <h3>En solo<span class="small-star">✳</span></h3>
            <p>
              Affûtez votre jeu. Nos bots ont plus d’un<br class="desktop-break" />
              tour dans leur manche.
            </p>
            <div class="solo-settings">
              <span>Adversaires bots</span>
              <div class="stepper">
                <button aria-label="Un bot de moins" :disabled="bots === 4" @click="bots--">
                  <Minus :size="14" /></button
                ><output aria-live="polite">{{ bots }}</output
                ><button aria-label="Un bot de plus" :disabled="bots === 8" @click="bots++">
                  <Plus :size="14" />
                </button>
              </div>
            </div>
            <button
              class="primary-btn mode-cta"
              :disabled="!connected || pending"
              @click="modal = 'solo'"
            >
              Jouer en solo <ArrowUpRight :size="19" />
            </button>
          </article>
          <article class="mode-card online-card">
            <div class="mode-top">
              <span class="mode-icon"><Users :size="24" :stroke-width="1.5" /></span
              ><span class="pill">DE 2 À 8 JOUEURS</span>
            </div>
            <h3>Entre amis<span class="small-suit">♠</span></h3>
            <p>Une table privée, un code à partager.<br />Les bons moments font le reste.</p>
            <button
              class="secondary-btn mode-cta"
              :disabled="!connected || pending"
              @click="modal = 'online'"
            >
              Créer une table <Plus :size="18" />
            </button>
            <form class="join-form" @submit.prevent="modal = 'join'">
              <label class="sr-only" for="room-code">Code du salon</label
              ><input
                id="room-code"
                v-model="joinCode"
                maxlength="4"
                pattern="[A-Fa-f0-9]{4}"
                placeholder="Code du salon"
                autocomplete="off"
                required
              /><button :disabled="!connected || joinCode.length !== 4 || pending" type="submit">
                Rejoindre <ArrowRight :size="17" />
              </button>
            </form>
          </article>
        </div>
      </section>
      <div class="home-bottom">
        <span><Spade :size="17" /> Simple à jouer. Difficile à quitter.</span
        ><span>Sans inscription <i>·</i> Gratuit <i>·</i> Juste pour le plaisir</span>
      </div>
    </main>

    <main v-else class="room-main">
      <div class="room-heading">
        <div>
          <button class="back-link" @click="showLeave = true">
            <ArrowLeft :size="15" /> Quitter la table
          </button>
          <h1>
            {{
              room.phase === 'waiting'
                ? 'La compagnie se forme.'
                : room.phase === 'finished'
                  ? 'La couronne a trouvé sa tête.'
                  : 'À vous la table.'
            }}
          </h1>
        </div>
        <div class="room-code">
          <span>{{ room.mode === 'solo' ? 'TABLE SOLO' : 'TABLE PRIVÉE' }}</span
          ><button @click="copy" :aria-label="`Copier le code ${room.code}`">
            {{ room.code }} <Copy :size="16" />
          </button>
        </div>
      </div>

      <section v-if="room.phase === 'waiting'" class="waiting-panel">
        <div class="waiting-icon"><Users :size="32" :stroke-width="1.4" /></div>
        <div class="eyebrow">LES MEILLEURES PARTIES COMMENCENT ICI</div>
        <h2>Gardez une place pour vos amis.</h2>
        <p>
          Partagez le code <strong>{{ room.code }}</strong> et retrouvez-vous à la même table.
        </p>
        <div class="waiting-seats">
          <div v-for="p in room.players" :key="p.id" class="waiting-player">
            <span class="avatar">{{ p.name.slice(0, 1).toUpperCase() }}</span
            ><strong>{{ p.name }}</strong
            ><span>{{
              p.id === room.hostId
                ? 'Hôte'
                : p.connected
                  ? 'Prêt à jouer'
                  : 'Absent · bot temporaire'
            }}</span>
          </div>
          <div
            v-for="i in Math.max(0, 4 - room.players.length)"
            :key="i"
            class="waiting-player empty"
          >
            <span class="avatar"><Plus :size="20" /></span><strong>Place libre</strong
            ><span>On attend la compagnie</span>
          </div>
        </div>
        <button
          v-if="isHost"
          class="primary-btn"
          :disabled="room.players.length < 2 || pending || !connected"
          @click="command('room:start')"
        >
          Lancer la partie <ArrowRight :size="18" />
        </button>
        <p v-else class="muted">L’hôte lancera la partie quand tout le monde sera prêt.</p>
        <span class="waiting-note">{{ room.players.length }} / 8 joueurs · 2 joueurs minimum</span>
      </section>

      <section v-else-if="room.phase === 'finished'" class="results-panel">
        <span class="result-crown"><Crown :size="48" :stroke-width="1.3" /></span>
        <div class="eyebrow">MANCHE {{ room.round }} TERMINÉE</div>
        <h2>
          {{ room.players.find((p) => p.id === room?.ranking[0])?.name }},<br /><em
            >à vous la présidence.</em
          >
        </h2>
        <div class="ranking-list">
          <div v-for="(id, i) in room.ranking" :key="id">
            <span class="rank-number">{{ String(i + 1).padStart(2, '0') }}</span
            ><strong
              >{{ room.players.find((p) => p.id === id)?.name }}
              <small v-if="id === room.selfId">vous</small></strong
            ><span>{{ roleLabel[room.players.find((p) => p.id === id)!.role] }}</span
            ><Crown v-if="i === 0" :size="19" />
          </div>
        </div>
        <button
          v-if="isHost"
          class="primary-btn"
          :disabled="pending || !connected"
          @click="command('game:next')"
        >
          La revanche ? <RefreshCw :size="18" />
        </button>
        <p v-else class="muted">L’hôte peut lancer la prochaine manche.</p>
      </section>

      <div v-else class="game-layout">
        <section class="game-area" aria-label="Table de jeu">
          <div class="table-toolbar">
            <span class="pill">MANCHE {{ room.round }}</span
            ><span
              >{{ room.direction === 1 ? 'Sens horaire' : 'Sens antihoraire' }}
              <RefreshCw :size="13" :class="{ reverse: room.direction === -1 }"
            /></span>
          </div>
          <div class="opponents">
            <div
              v-for="(p, i) in others"
              :key="p.id"
              class="opponent"
              :class="{ active: room.turn === p.id, done: p.count === 0 }"
              :style="{ '--player-color': ['#ede5da', '#dee8e3', '#eadfe5', '#e5e5d2'][i % 4] }"
            >
              <span class="avatar"
                >{{ p.name.slice(0, 1).toUpperCase()
                }}<Bot v-if="p.bot || !p.connected" :size="13" class="bot-badge" /></span
              ><strong>{{ p.name }}</strong
              ><span v-if="p.count">{{ p.count }} cartes</span
              ><span v-else>{{
                p.finish ? `${p.finish}${p.finish === 1 ? 'er' : 'e'}` : 'Sorti'
              }}</span
              ><span v-if="room.turn === p.id" class="turn-indicator">À son tour</span>
            </div>
          </div>
          <div
            class="felt-table"
            :data-format="room.table?.format ?? 0"
            :data-rank="room.table?.rank ?? 0"
            :data-equal="room.table?.equalRequired ?? false"
            :class="{ exchange: room.phase === 'exchange' }"
          >
            <span class="felt-line"></span>
            <div class="table-wordmark"><Crown :size="17" /> le président.</div>
            <Transition name="pile" mode="out-in"
              ><div v-if="room.phase === 'exchange'" key="exchange" class="table-message">
                <RefreshCw :size="30" />
                <h3>Les petits arrangements.</h3>
                <p>{{ self ? roleLabel[self.role] : '' }} · {{ selectionHint }}</p>
                <span v-if="room.exchangeSubmitted" class="table-note"
                  ><Check :size="15" /> Votre contribution est prête</span
                ><span v-else-if="!room.exchangeCount" class="table-note"
                  >Vos meilleures cartes sont réservées automatiquement.</span
                >
              </div>
              <div
                v-else-if="room.table"
                :key="room.table.cards.map((c) => c.id).join(',')"
                class="center-pile"
              >
                <div class="pile-cards">
                  <PlayingCard
                    v-for="(card, i) in room.table.cards"
                    :key="card.id"
                    :card="card"
                    :index="i"
                    small
                  />
                </div>
                <span class="pile-caption"
                  >{{ room.players.find((p) => p.id === room?.table?.owner)?.name }} <i>·</i>
                  {{
                    room.table.format === 1
                      ? 'Simples'
                      : room.table.format === 2
                        ? 'Paires'
                        : 'Triples'
                  }}<b v-if="room.table.equalRequired">Même valeur ou passe</b></span
                >
              </div>
              <div v-else key="empty" class="table-message">
                <Spade :size="32" :stroke-width="1.2" />
                <h3>Un nouveau pli, tout est possible.</h3>
                <p>{{ isTurn ? 'À vous de l’ouvrir.' : `${turnName} ouvre le pli.` }}</p>
              </div></Transition
            >
            <div class="table-bottom">
              <span class="table-note">{{
                room.phase === 'exchange'
                  ? 'Échanges simultanés'
                  : room.table?.format === 3
                    ? 'Triples · coupe interdite'
                    : 'Un carré peut tout changer.'
              }}</span>
            </div>
          </div>
          <div class="hand-panel">
            <div class="hand-heading">
              <div>
                <span class="self-avatar">{{ self?.name.slice(0, 1).toUpperCase() }}</span
                ><strong>{{ self?.name }} <span>vous</span></strong
                ><span class="self-role">{{ self ? roleLabel[self.role] : '' }}</span>
              </div>
              <span class="turn-pill" :class="{ yourturn: isTurn }">{{
                room.phase === 'exchange'
                  ? 'Phase d’échange'
                  : self?.count === 0
                    ? 'Vous avez terminé'
                    : isTurn
                      ? 'C’est votre tour'
                      : `Au tour de ${turnName}`
              }}</span>
            </div>
            <div class="hand-scroll">
              <TransitionGroup name="hand" tag="div" class="hand-cards"
                ><PlayingCard
                  v-for="(card, i) in room.hand"
                  :key="card.id"
                  :card="card"
                  interactive
                  :selected="selected.includes(card.id)"
                  :index="i"
                  @select="toggle(card.id)"
              /></TransitionGroup>
            </div>
            <div class="hand-controls">
              <p>
                {{
                  selected.length
                    ? `${selected.length} carte${selected.length > 1 ? 's' : ''} sélectionnée${selected.length > 1 ? 's' : ''}`
                    : selectionHint
                }}<button v-if="selected.length" class="clear-selection" @click="selected = []">
                  Effacer
                </button>
              </p>
              <div>
                <button
                  v-if="room.phase === 'playing'"
                  class="pass-btn"
                  :disabled="!isTurn || !room.table || pending || !connected"
                  @click="command('game:pass')"
                >
                  Passer</button
                ><button
                  class="primary-btn"
                  :disabled="!(canPlay || canExchange) || pending || !connected"
                  @click="play"
                >
                  {{
                    room.phase === 'exchange'
                      ? 'Donner mes cartes'
                      : canCut
                        ? 'Couper le carré'
                        : 'Jouer mes cartes'
                  }}
                  <ArrowRight :size="17" />
                </button>
              </div>
            </div>
          </div>
        </section>
        <aside class="game-sidebar">
          <div class="side-card">
            <span class="side-eyebrow">LE FIL DE LA PARTIE</span>
            <h3>Autour de la table.</h3>
            <ol class="activity-list" aria-live="polite" aria-relevant="additions">
              <li
                v-for="(line, i) in room.log.slice(-7).reverse()"
                :key="`${room.log.length}-${i}-${line}`"
              >
                <span class="activity-dot"></span>{{ line }}
              </li>
            </ol>
          </div>
          <div class="side-card tip-card">
            <Heart :size="20" :stroke-width="1.5" />
            <h3>Le petit rappel.</h3>
            <p>
              La Dame de pique inverse le sens. Le 2 nettoie le pli. Et finir sur un 2 vous envoie
              tout en bas.
            </p>
            <button class="text-btn" @click="showRules = true">
              Toutes les règles <ChevronRight :size="15" />
            </button>
          </div>
        </aside>
      </div>
    </main>
    <footer>
      <span>Fait pour les bonnes compagnies.</span
      ><span>le président. <span class="footer-suits">♣ ♦ ♠ ♥</span></span>
    </footer>
    <div v-if="!connected && room" class="reconnect-banner" role="status">
      <WifiOff :size="17" /> Connexion interrompue. Nous vous ramenons à la table…
    </div>
    <Transition name="toast"
      ><div v-if="notice" class="toast-message" role="status">
        <Check :size="18" />{{ notice }}
      </div></Transition
    >
    <div v-if="error && !modalOpen" class="error-banner" role="alert">
      {{ error
      }}<button @click="error = ''" aria-label="Fermer le message"><X :size="16" /></button>
    </div>

    <div
      v-if="modalOpen"
      class="modal-backdrop"
      @click.self="!pending && ((modal = null), (showRules = false), (showLeave = false))"
    >
      <section
        ref="dialog"
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="showRules ? 'rules-title' : showLeave ? 'leave-title' : 'entry-title'"
      >
        <button
          class="modal-close"
          :disabled="pending"
          @click="
            modal = null;
            showRules = false;
            showLeave = false;
          "
          aria-label="Fermer"
        >
          <X :size="20" />
        </button>
        <template v-if="showRules"
          ><div class="eyebrow">LE PRÉSIDENT, MODE D’EMPLOI</div>
          <h2 id="rules-title">Les bonnes cartes<br /><em>sur la table.</em></h2>
          <div class="rules-content">
            <p>
              <strong>Le but.</strong> Videz votre main avant les autres. Ordre : 3, 4, 5, 6, 7, 8,
              9, 10, V, D, R, A, 2.
            </p>
            <p>
              <strong>Le pli.</strong> Ouvrez en simple, paire ou triple. Gardez ce format, avec une
              valeur supérieure ou égale. Après une égalité, le suivant joue cette même valeur ou
              passe. Une passe libère la contrainte et vous retire du pli jusqu’au nettoyage.
            </p>
            <p>
              <strong>Les dames.</strong> La Dame de cœur ouvre la première manche. La Dame de pique
              inverse le sens dès sa pose.
            </p>
            <p>
              <strong>Le carré.</strong> Complétez les quatre cartes de même valeur présentes
              consécutivement sur la table, même hors tour. Vous nettoyez et relancez. Aucune coupe
              sur un pli en triples.
            </p>
            <p>
              <strong>Le 2.</strong> Il respecte le format, nettoie la table et vous redonne la
              main. Finir sur un 2 vous place dernier !
            </p>
            <p>
              <strong>La sortie.</strong> Quand un joueur termine, le pli s’arrête et son voisin
              encore en jeu ouvre.
            </p>
            <p>
              <strong>La prochaine manche.</strong> Le Trou du cul donne ses 2 meilleures cartes au
              Président, qui choisit 2 cartes à rendre. Même principe entre les vice-rôles avec 1
              carte, à partir de 4 joueurs. Le Trou du cul ouvre.
            </p>
          </div>
          <button class="primary-btn" @click="showRules = false">
            Bien reçu <Check :size="17" /></button
        ></template>
        <template v-else-if="showLeave"
          ><div class="eyebrow">ON SE RETROUVE BIENTÔT ?</div>
          <h2 id="leave-title">Quitter la table ?</h2>
          <p>
            {{
              room?.phase === 'waiting'
                ? 'Votre place sera libérée.'
                : 'Un bot prendra votre place pour que la partie continue.'
            }}
          </p>
          <div class="modal-actions">
            <button class="secondary-btn" @click="showLeave = false">Rester</button
            ><button class="primary-btn" :disabled="pending" @click="leave">
              Quitter <LogOut :size="17" />
            </button></div
        ></template>
        <template v-else
          ><span class="entry-icon"
            ><Bot v-if="modal === 'solo'" :size="27" /><Users v-else :size="27"
          /></span>
          <div class="eyebrow">
            {{
              modal === 'solo'
                ? `${bots} BOTS VOUS ATTENDENT`
                : modal === 'join'
                  ? `TABLE ${joinCode.toUpperCase()}`
                  : 'INVITEZ LA BONNE COMPAGNIE'
            }}
          </div>
          <h2 id="entry-title">Comment vous<br /><em>appelle-t-on ?</em></h2>
          <p>Un petit nom, et les cartes sont à vous.</p>
          <form class="entry-form" @submit.prevent="enter">
            <label for="player-name">Votre pseudo</label
            ><input
              id="player-name"
              ref="nameInput"
              v-model="name"
              minlength="1"
              maxlength="24"
              required
              placeholder="Ex. Gabin"
              autocomplete="nickname"
              :disabled="pending"
            />
            <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
            <button
              class="primary-btn"
              type="submit"
              :disabled="!name.trim() || pending || !connected"
            >
              {{
                pending
                  ? 'Un instant…'
                  : modal === 'solo'
                    ? 'À moi de jouer'
                    : modal === 'join'
                      ? 'Rejoindre la table'
                      : 'Créer ma table'
              }}
              <ArrowRight :size="18" />
            </button></form
        ></template>
      </section>
    </div>
  </div>
</template>
