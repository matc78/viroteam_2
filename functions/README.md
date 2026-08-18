# Cloud Functions ViroTeam

Logique sensible hors client (HelloAsso, invitations). Spec paiement :
[`docs/specs/viroteam_v2_payments_helloasso_spec.md`](../docs/specs/viroteam_v2_payments_helloasso_spec.md).

## Contenu

| Function | Rôle |
|----------|------|
| `acceptInvitation` | Callable — accepter une invitation |
| `inviteGuardian` | Callable — admin invite un parent (plafond V1 = 1) |
| `linkGuardian` | Callable — active guardian + `parentLinks` (deux faces) |
| `revokeGuardian` | Callable — révoque le lien parent (deux faces) |
| `setEventRsvp` | Callable — RSVP pour soi ou un enfant lié |
| `createHelloAssoCheckout` | Callable — crée un checkout HelloAsso (1×/3× + aides) |
| `helloAssoWebhook` | HTTP — crédite `amountPaidCents` / statut **uniquement** après notif serveur |
| `paymentWebhook` | Alias de `helloAssoWebhook` (compat) |

## Secrets / params

```bash
firebase functions:secrets:set HELLOASSO_CLIENT_ID
firebase functions:secrets:set HELLOASSO_CLIENT_SECRET
# optionnel
firebase functions:config:set ... # ou params:
# HELLOASSO_API_BASE=https://api.helloasso.com
# (sandbox : https://api.helloasso-sandbox.com)
# FIRESTORE_DATABASE_ID=v2-dev   # ou v2-prod
```

Sur chaque club : champ `helloAssoOrganizationSlug`.

Webhook : coller l’URL de `helloAssoWebhook` dans HelloAsso → Mon Compte → Intégrations et API (types Order + Payment).

## Setup

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

**Important** : le `returnUrl` client ne doit jamais marquer une cotisation `paye`.
