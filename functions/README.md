# Cloud Functions ViroTeam

Logique sensible hors client (HelloAsso, invitations). Spec paiement :
[`docs/specs/viroteam_v2_payments_helloasso_spec.md`](../docs/specs/viroteam_v2_payments_helloasso_spec.md).

## Contenu

| Function | Rôle |
|----------|------|
| `acceptInvitation` / `acceptInvitationDev` | Callable — accepter une invitation **membre** (refuse `type: guardian`) |
| `sendMemberInvites` / `sendMemberInvitesDev` | Callable — envoie les e-mails d’invitation membre via Brevo |
| `inviteGuardian` / `inviteGuardianDev` | Callable — admin ou titulaire invite un parent (plafond V1 = 1 ; pas de create client) |
| `linkGuardian` / `linkGuardianDev` | Callable — active guardian + `parentLinks` (deux faces ; e-mail Auth obligatoire) |
| `revokeGuardian` / `revokeGuardianDev` | Callable — révoque le lien parent (purge `parentLinks`) |
| `updateGuardianInviteEmail` / `…Dev` | Callable — change l’e-mail d’une invite parent pending (+ réelign guardian pending) |
| `extendGuardianInvite` / `…Dev` | Callable — prolonge l’expiration d’une invite parent |
| `regenerateGuardianInvite` / `…Dev` | Callable — nouveau code + reset expiration invite parent |
| `setEventRsvp` / `setEventRsvpDev` | Callable — RSVP pour soi ou un enfant lié |
| `createHelloAssoCheckout` / `…Dev` | Callable — crée un checkout HelloAsso (1×/3× + aides) |
| `helloAssoWebhook` / `helloAssoWebhookDev` | HTTP — crédite `amountPaidCents` / statut **uniquement** après notif serveur ; **503** sans `HELLOASSO_WEBHOOK_TOKEN`, **401** sans jeton valide (`?token=` ou header `x-webhook-token`), **400** sans `externalPaymentId` |
| `lookupInvitationByCode` / `…Dev` | Callable **sans auth** — retrouve une invitation pending par code (e-mail masqué `emailHint`, jamais l’e-mail complet) |
| `deleteMyAccount` / `deleteMyAccountDev` | Callable — anonymise les fiches du compte (cascade tolérante aux erreurs) puis supprime le compte Auth |
| `setMemberRole` / `setMemberRoleDev` | Callable — admin du club change un rôle (garde « dernier admin », sync `adminIds` + `clubMemberships`) |
| `removeMember` / `removeMemberDev` | Callable — admin du club retire un membre (garde « dernier admin », rosters, invitation → `revoked`, `member_accounts`) |
| `onTeamWritten` / `onTeamWrittenDev` | Trigger Firestore `clubs/{clubId}/teams/{teamId}` — recalcule `users/{uid}.parentTeamIds` des parents des joueurs ajoutés/retirés |

**Environnements** : sans suffixe → Firestore `v2-prod` ; suffixe `Dev` → `v2-dev`.
L’app Flutter (`cloudCallableName`) et le portail (`NEXT_PUBLIC_FIRESTORE_DATABASE_ID`) choisissent le bon nom.

Les invites **parent** ne passent pas par Brevo en V1 : le client partage le code (copie / message).
Les docs `invitations` `type: guardian` sont créés **uniquement** via `inviteGuardian` (rules : create/accept client interdits).

## Secrets / params

```bash
firebase functions:secrets:set HELLOASSO_CLIENT_ID
firebase functions:secrets:set HELLOASSO_CLIENT_SECRET
firebase functions:secrets:set HELLOASSO_WEBHOOK_TOKEN   # jeton aléatoire long ; vide ⇒ webhook désactivé (503)
firebase functions:secrets:set BREVO_API_KEY
# optionnel (params / .env)
# HELLOASSO_API_BASE=https://api.helloasso.com
# (sandbox : https://api.helloasso-sandbox.com)
# BREVO_SENDER_EMAIL=noreply@viroteam.com
# BREVO_SENDER_NAME=ViroTeam
# INVITE_JOIN_BASE_URL=https://www.viroteam.com
```

Brevo : domaine `viroteam.com` authentifié + expéditeur `noreply@viroteam.com`.
La callable `sendMemberInvites` envoie un mail transactionnel par membre (code individuel).

Sur chaque club : champ `helloAssoOrganizationSlug`.

Webhook : coller l’URL de `helloAssoWebhook` **suffixée `?token=<HELLOASSO_WEBHOOK_TOKEN>`** dans HelloAsso → Mon Compte → Intégrations et API (types Order + Payment).
Tant qu’aucun secret n’est configuré, le webhook répond 503 (décision produit : HelloAsso non prévu pour l’instant).

Reçus PDF : stockés dans `receipts/{clubId}/{seasonId}/…` (bucket privé, plus de `makePublic`) ; `member_fees.receiptUrl` est une **URL signée valable 1 h** (le compte de service des functions doit avoir le rôle *Service Account Token Creator* pour signer).

`parentTeamIds` : maintenu **uniquement** côté serveur (`linkGuardian`, `revokeGuardian`, `updateGuardianInviteEmail`, trigger `onTeamWritten`) via `recomputeParentTeamIds` (`src/parentTeams.ts`).

## Setup

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Un `firebase deploy --only functions` pousse **toutes** les callables duales (`acceptInvitation` + `acceptInvitationDev`, etc.).

## Déploiement CI

Taguer depuis `main` vert. Workflow : [`.github/workflows/deploy-functions.yml`](../.github/workflows/deploy-functions.yml).

| Déclencheur | Environment GitHub | Effet |
|-------------|-------------------|--------|
| Tag `functions-dev-v1.2.3` | `firebase-dev` | Deploy all functions (dual) |
| Tag `functions-v1.2.3` | `firebase-prod` | Deploy all functions (dual) |
| **Actions → Deploy functions → Run workflow** (`dev` / `prod`) | idem | Idem sans tag |

Secret requis : `FIREBASE_SERVICE_ACCOUNT_DEPLOY` (voir [`SETUP_LOCAL.md`](../SETUP_LOCAL.md)).  
Les secrets runtime (Brevo, HelloAsso) restent gérés via `firebase functions:secrets`, pas via GitHub Actions.

```bash
git tag functions-dev-v1.0.0 && git push origin functions-dev-v1.0.0
git tag functions-v1.0.0 && git push origin functions-v1.0.0
```

**Important** : le `returnUrl` client ne doit jamais marquer une cotisation `paye`.