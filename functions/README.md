# Cloud Functions ViroTeam

Scaffold pour la logique sensible hors client (voir `docs/ROADMAP.md` Phase 5).

## Contenu

| Function | Rôle |
|----------|------|
| `acceptInvitation` | Callable — accepter une invitation (à brancher côté app) |
| `paymentWebhook` | HTTP — marquer une cotisation `paye` après paiement (signature prestataire à ajouter) |

## Setup

```bash
cd functions
npm install
npm run build
```

Déploiement (après config Firebase) :

```bash
firebase deploy --only functions
```

Le client Flutter continue d’accepter les invitations en direct tant que `acceptInvitation` n’est pas branché.
