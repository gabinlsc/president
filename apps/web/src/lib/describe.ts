import {
  ROLE_LABELS,
  rankLabel,
  type GameEvent,
  type PlayerId,
  type Role,
  type TrickFormat,
} from '@president/shared';

export const FORMAT_LABELS: Readonly<Record<TrickFormat, string>> = {
  1: 'Simples',
  2: 'Paires',
  3: 'Triples',
};

export const roleLabel = (role: Role): string => ROLE_LABELS[role];

export const placeLabel = (place: number): string => `${place}${place === 1 ? 'er' : 'e'}`;

/** Human-readable line for the activity feed, or null for silent events. */
export function describeEvent(event: GameEvent, name: (id: PlayerId) => string): string | null {
  switch (event.type) {
    case 'dealt':
      return `Distribution de la manche ${event.round}.`;
    case 'exchanged':
      return 'Les échanges sont faits.';
    case 'played': {
      const [first] = event.cards;
      if (!first) return null;
      const count = event.cards.length;
      const what =
        count === 1 ? `un ${rankLabel(first.rank)}` : `${count} × ${rankLabel(first.rank)}`;
      return event.outOfTurn
        ? `${name(event.playerId)} coupe avec ${what} !`
        : `${name(event.playerId)} pose ${what}.`;
    }
    case 'passed':
      return `${name(event.playerId)} passe.`;
    case 'reversed':
      return 'Dame de pique : le sens s’inverse.';
    case 'trickCleared':
      switch (event.reason) {
        case 'two':
          return 'Le 2 remporte le pli.';
        case 'square':
          return 'Carré ! La table est nettoyée.';
        case 'presidentOut':
          return 'Premier sorti : le pli s’arrête.';
        case 'allPassed':
          return event.leaderId
            ? `Tout le monde passe : ${name(event.leaderId)} reprend la main.`
            : null;
      }
      return null;
    case 'playerFinished':
      return event.penalized
        ? `${name(event.playerId)} finit sur un 2 : Trou du cul d’office !`
        : `${name(event.playerId)} a posé sa dernière carte.`;
    case 'roundOver':
      return 'Manche terminée.';
  }
}
