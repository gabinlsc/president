# Contrat réseau — v1

Socket.IO sur `/socket.io`, même origine en production. Chaque événement reçoit un ACK
`{ok:true,data}` ou `{ok:false,error}`. Types : `packages/shared/src/index.ts`.
Le serveur publie `room:state` individuellement : seule la main du destinataire apparaît.

| Client → serveur | Entrée | Résultat |
| --- | --- | --- |
| room:create | name, mode, bots (solo: 4–8) | Session, salon unique |
| room:join | code, name | Session, salon en attente, max 8 humains |
| session:resume | token | Session, remplace la connexion précédente |
| room:start | aucune | Hôte uniquement, 2–8 humains ou 1 humain + 4–8 bots |
| room:leave | aucune | Quitte le salon; en cours, remplacement par bot |
| game:play | cards: identifiants uniques | Coup validé par le moteur |
| game:pass | aucune | Passe validée par le moteur |
| game:exchange | cards: identifiants uniques | Choix du Président / Vice-président |
| game:next | aucune | Hôte uniquement, manche suivante |

Identités et autorisations viennent de la session serveur, jamais d'un playerId client.
Une reconnexion utilise un jeton opaque aléatoire. Un déconnecté est temporairement joué
par un bot. Salons en mémoire : redémarrer efface les sessions et parties.
`GET /health` → 200 JSON `{status:"ok"}`; autres routes inconnues → 404.
