import type { RuleViolation, RuleViolationCode } from '@president/shared';

export const RULE_MESSAGES: Readonly<Record<RuleViolationCode, string>> = {
  WRONG_PHASE: 'Cette action n’est pas possible à ce moment de la partie.',
  UNKNOWN_PLAYER: 'Joueur inconnu à cette table.',
  DUPLICATE_PLAYER: 'Ce joueur est déjà assis.',
  TABLE_FULL: 'La table est complète (8 joueurs).',
  NOT_ENOUGH_PLAYERS: 'Il faut au moins 2 joueurs.',
  INVALID_SELECTION: 'Sélection de cartes invalide.',
  CARDS_NOT_IN_HAND: 'Ces cartes ne sont pas dans votre main.',
  MIXED_RANKS: 'Jouez des cartes de même valeur.',
  NOT_YOUR_TURN: 'Ce n’est pas votre tour.',
  ALREADY_PASSED: 'Vous avez déjà passé sur ce pli.',
  FORMAT_MISMATCH: 'Respectez le format du pli (simple, paire ou triple).',
  RANK_TOO_LOW: 'Jouez une valeur supérieure ou égale.',
  SAME_RANK_REQUIRED: 'Même carte obligatoire : jouez la même valeur ou passez.',
  SQUARE_MUST_CUT: 'Un carré ne s’ouvre pas : il se complète sur la table pour couper.',
  CANNOT_PASS_ON_LEAD: 'Vous ouvrez le pli : posez une carte.',
  NO_EXCHANGE_EXPECTED: 'Vous n’avez aucune carte à choisir pour cet échange.',
  EXCHANGE_ALREADY_SUBMITTED: 'Échange déjà validé.',
  WRONG_CARD_COUNT: 'Nombre de cartes à donner incorrect.',
};

/** Internal control flow only: `transition` turns it into a `RuleViolation` result. */
export class RuleBreak extends Error {
  readonly violation: RuleViolation;
  constructor(code: RuleViolationCode) {
    super(RULE_MESSAGES[code]);
    this.violation = { code, message: RULE_MESSAGES[code] };
  }
}

export function ensure(condition: unknown, code: RuleViolationCode): asserts condition {
  if (!condition) throw new RuleBreak(code);
}
