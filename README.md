# Le Président

Jeu de cartes en temps réel : Vue 3, Tailwind CSS, TypeScript, Node.js et Socket.IO.
Le serveur est l'unique autorité sur les coups et les mains.

## Démarrage

Node.js ≥ 22.12. `npm install`, puis `npm run dev`.
Ouvrir http://localhost:5173. Serveur : http://localhost:3001.
`npm run check` lance les types, tests et builds.
Contrat : [docs/protocol.md](docs/protocol.md).

## Livraison

Cinq branches et PR : init → game-engine → socket-rooms → solo-bots → ui-animations.
Les branches sont empilées et les PR ciblent main; intégrer dans cet ordre.
Aucun push direct sur main.
