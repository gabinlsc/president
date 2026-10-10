# Contrat réseau — v2

Socket.IO sur `/socket.io`, même origine en production. Types partagés :
`packages/shared/src/types`. Entrées validées par les schémas zod de
`packages/shared/src/schemas.ts`.

Chaque requête reçoit un ACK `{ ok: true, data }` ou `{ ok: false, error }` (message
affichable). Identité et autorisations viennent de la session serveur liée à la socket,
jamais d'un identifiant envoyé par le client.

| Client → serveur | Entrée                       | Effet                                                 |
| ---------------- | ---------------------------- | ----------------------------------------------------- |
| `room:create`    | `name`, `mode`, `bots` (4–7) | Session ; en solo la donne démarre aussitôt           |
| `room:join`      | `code`, `name`               | Session ; uniquement dans le lobby, 8 joueurs maximum |
| `session:resume` | `token`                      | Session ; évince la socket précédente                 |
| `room:start`     | —                            | Hôte uniquement, 2 joueurs minimum                    |
| `room:leave`     | —                            | Lobby : libère la place. En partie : un bot reprend   |
| `game:play`      | `cards` : identifiants       | Coup validé par le moteur (coupe hors tour comprise)  |
| `game:pass`      | —                            | Passe                                                 |
| `game:exchange`  | `cards` : identifiants       | Choix du Président / Vice-président                   |
| `game:next`      | —                            | Hôte uniquement, manche suivante                      |
| `game:autoCut`   | `enabled` : booléen          | Coupe automatique hors tour pour ce joueur            |

## `room:state`

Le serveur envoie à chaque membre son propre `RoomSnapshot` après chaque changement :

- `version` : compteur monotone ; le client ignore un instantané plus ancien.
- `game` (`GameView`) : phase, sièges publics (nombre de cartes, statut, rang), pli,
  sens (`isReversed`), **la main du destinataire uniquement**, `legalPlays` (tous les coups
  autorisés, coupes hors tour comprises) et `canPass`. Le client ne réimplémente aucune règle.
- `events` : faits publics de la transition (`played`, `passed`, `reversed`,
  `trickCleared`, `playerFinished`, `dealt`, `exchanged`, `roundOver`) qui pilotent les
  animations et le fil de la partie.

## Rythme

Le serveur joue lui-même la fin de la distribution, les bots et les joueurs déconnectés.
Il laisse `DEAL_DELAY` ms pour animer la donne, un temps de réflexion d'environ `BOT_DELAY` ms
(± 25 %) entre deux coups automatiques, et ajoute `CLEAR_PAUSE` ms après un pli nettoyé.
Une table sans humain connecté est gelée.

`GET /health` → 200 `{"status":"ok"}` ; toute autre route inconnue → 404.
