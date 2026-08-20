# Cloud Functions ViroTeam

Logique sensible hors client (HelloAsso, invitations). Spec paiement :
[`docs/specs/viroteam_v2_payments_helloasso_spec.md`](../docs/specs/viroteam_v2_payments_helloasso_spec.md).

## Contenu

| Function | Rôle |
|----------|------|
| `acceptInvitation` | Callable — accepter une invitation **membre** (refuse `type: guardian`) |
| `sendMemberInvites` | Callable — envoie les e-mails d’invitation membre via Brevo |
| `inviteGuardian` | Callable — admin ou titulaire invite un parent (plafond V1 = 1 ; pas de create client) |
| `linkGuardian` | Callable — active guardian + `parentLinks` (deux faces ; e-mail Auth obligatoire) |
| `revokeGuardian` | Callable — révoque le lien parent (purge `parentLinks`) |
| `updateGuardianInviteEmail` | Callable — change l’e-mail d’une invite parent pending (+ réelign guardian pending) |
| `extendGuardianInvite` | Callable — prolonge l’expiration d’une invite parent |
| `regenerateGuardianInvite` | Callable — nouveau code + reset expiration invite parent |
| `setEventRsvp` | Callable — RSVP pour soi ou un enfant lié |
| `createHelloAssoCheckout` | Callable — crée un checkout HelloAsso (1×/3× + aides) |
| `helloAssoWebhook` | HTTP — crédite `amountPaidCents` / statut **uniquement** après notif serveur |
| `paymentWebhook` | Alias de `helloAssoWebhook` (compat) |

Les invites **parent** ne passent pas par Brevo en V1 : le client partage le code (copie / message).
Les docs `invitations` `type: guardian` sont créés **uniquement** via `inviteGuardian` (rules : create/accept client interdits).

## Secrets / params

```bash
firebase functions:secrets:set HELLOASSO_CLIENT_ID
firebase functions:secrets:set HELLOASSO_CLIENT_SECRET
firebase functions:secrets:set BREVO_API_KEY
# optionnel (params / .env)
# HELLOASSO_API_BASE=https://api.helloasso.com
# (sandbox : https://api.helloasso-sandbox.com)
# FIRESTORE_DATABASE_ID=v2-dev   # ou v2-prod
# BREVO_SENDER_EMAIL=noreply@viroteam.com
# BREVO_SENDER_NAME=ViroTeam
# INVITE_JOIN_BASE_URL=https://www.viroteam.com
```

Brevo : domaine `viroteam.com` authentifié + expéditeur `noreply@viroteam.com`.
La callable `sendMemberInvites` envoie un mail transactionnel par membre (code individuel).

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
