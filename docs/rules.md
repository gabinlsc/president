# Règles et conventions

Moteur : `packages/game` (réducteur pur `transition(state, action)`). Chaque règle
ci-dessous est couverte par `tests/game/*.test.ts`.

## Cycle d'une table

`lobby → dealing → exchanging → playing → roundOver → dealing → …`

Chaque action n'est acceptée que dans une seule phase (`ACTION_PHASES`) ; toute autre
transition est refusée (`PHASE_TRANSITIONS`). La phase `exchanging` est sautée à la
première manche.

## Cartes et plis

- 52 cartes, toutes distribuées. Ordre : 3 < 4 < … < 10 < V < D < R < As < 2.
- Le détenteur de la Dame de cœur débute la première manche, avec la carte de son choix.
- Un pli se lance en simples, paires ou triples ; il se poursuit dans ce format, à valeur
  égale ou supérieure. Un carré complet peut ouvrir le pli : il le ferme aussitôt et son
  auteur relance.
- **Même carte** : poser la même valeur que la pose précédente oblige le joueur suivant à
  jouer cette valeur ou à passer. S'il la joue, le suivant subit la contrainte à son tour.
  Une passe lève la contrainte.
- Un joueur qui passe ne rejoue plus sur ce pli, sauf pour couper.
- **Le 2** respecte le format et la contrainte « même carte », puis remporte le pli :
  la table est nettoyée et son auteur relance.
- **Dame de pique** : inverse immédiatement le sens de rotation (`isReversed`), y compris
  posée dans une paire ou un triple.
- **Couper** : compléter un carré hors tour (y compris après avoir passé) avec **autant de
  cartes que le format du pli** et les cartes de même valeur posées consécutivement. Ex. : 4,
  puis 4 : le joueur suivant qui tient deux 4 ne peut en poser qu'un, et ne peut pas couper sur
  sa propre carte ; un autre joueur peut alors couper avec le dernier 4. La table est nettoyée
  et le coupeur relance. Interdit si le pli a commencé en triples. Dans l'interface, le bouton
  « Couper » s'allume dès qu'une coupe est possible et coupe en un clic.
- Quand tous les autres joueurs encore en jeu ont passé, le dernier poseur relance ; s'il
  est sorti, c'est le joueur actif suivant.

## Sorties et classement

- **Arrêt sur victoire** : le premier joueur à finir (Président) arrête le pli ; son voisin
  encore en jeu relance. Les joueurs qui finissent ensuite ne coupent pas le pli : leur tour
  est simplement sauté.
- **Punition du 2** : finir sur un 2 classe derrière tous les autres. Avec plusieurs punis,
  le dernier à finir sur un 2 est dernier. Un puni ne devient jamais Président.
- La manche s'arrête quand il ne reste qu'un joueur avec des cartes.
- Rôles : 2 joueurs → Président, Trou du cul ; 3 joueurs → + Citoyen ; 4 joueurs et plus →
  Président, Vice-président, Citoyens, Vice-trouduc, Trou du cul.

## Échanges

À partir de la deuxième manche, après la distribution :

| Donne          | Reçoit         | Cartes | Choix                   |
| -------------- | -------------- | ------ | ----------------------- |
| Trou du cul    | Président      | 2      | ses meilleures (imposé) |
| Président      | Trou du cul    | 2      | libre                   |
| Vice-trouduc   | Vice-président | 1      | sa meilleure (imposé)   |
| Vice-président | Vice-trouduc   | 1      | libre                   |

Les cartes sont choisies dans la main distribuée et transférées simultanément.
Le Trou du cul ouvre ensuite et le sens repart à l'endroit.
