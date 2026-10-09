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

## Jouer

- **Solo** : choisissez 4 à 8 adversaires, puis votre pseudo. La donne démarre immédiatement.
- **Entre amis** : créez une table, partagez le code à quatre caractères, puis lancez
  la partie depuis le compte hôte dès que 2 à 8 joueurs sont réunis.
- Cliquez sur les cartes pour les sélectionner, puis jouez ou passez. Une coupe
  pour compléter un carré est possible hors tour. Les choix d'échange sont validés
  ensemble avant la nouvelle manche.
- Recharger un onglet restaure la session. Pendant une absence, un bot joue à votre
  place; revenir récupère la main actuelle. Quitter explicitement révoque la session.

Règles et conventions détaillées : [docs/rules.md](docs/rules.md).

## Validation navigateur

`npx playwright install chromium`, puis `npm run test:e2e`.
Les tests démarrent les serveurs et couvrent le lobby à 1440/390/320 px, le clavier,
deux navigateurs en multijoueur, la reprise après rechargement, une manche solo complète
et les échanges de la manche suivante. Captures dans `test-results/visual/`.
La CI exécute également ces parcours.

## Production

`npm ci`, `npm run build`, puis `npm start`. Le serveur Node sert aussi le frontend
compilé sur le port 3001. Définissez `CLIENT_ORIGIN` avec l'origine publique exacte
(par exemple `https://president.example`) et configurez votre proxy pour transmettre
les WebSockets. `PORT` change le port; `STATIC_DIR` change le répertoire du frontend.
Les variables doivent être définies dans l'environnement du processus.
`VITE_SERVER_URL` est facultatif et permet un serveur séparé (défini lors du build).
`BOT_DELAY` règle la durée de réflexion en millisecondes (850 par défaut).

L'état est en mémoire dans un processus Node unique. Un redémarrage efface les parties.
Les salons sans humain connecté expirent après 30 minutes. Le jeton est conservé dans
sessionStorage de l'onglet; aucun compte ni base de données persistante n'est nécessaire.
Un déploiement à plusieurs instances nécessiterait un stockage partagé et un adaptateur
Socket.IO, ainsi qu'une coordination autoritaire des moteurs de parties.

Références : [Vue et TypeScript](https://vuejs.org/guide/typescript/overview),
[Tailwind avec Vite](https://tailwindcss.com/docs/installation/using-vite),
[Socket.IO serveur](https://socket.io/docs/v4/server-api/).
