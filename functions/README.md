# Cloud Functions ViroTeam

Logique sensible hors client (HelloAsso, invitations). Spec paiement :
[`docs/specs/viroteam_v2_payments_helloasso_spec.md`](../docs/specs/viroteam_v2_payments_helloasso_spec.md).

## Contenu

| Function | R�le |
|----------|------|
| `acceptInvitation` / `acceptInvitationDev` | Callable — accepter une invitation **membre** (refuse `type: guardian`) ; mail confirmation à l'inviteur (Guy / Brevo, soft-fail) |
| `sendMemberInvites` / `sendMemberInvitesDev` | Callable — e-mails d'invitation membre via Brevo (voix Guy, variantes player/coach/admin) |
| `inviteGuardian` / `inviteGuardianDev` | Callable — admin ou titulaire invite un parent (plafond V1 = 1) + e-mail Brevo auto |
| `linkGuardian` / `linkGuardianDev` | Callable — active guardian + `parentLinks` ; mail confirmation à l'inviteur (soft-fail) |
| `revokeGuardian` / `revokeGuardianDev` | Callable ? r�voque le lien parent (purge `parentLinks`) |
| `updateGuardianInviteEmail` / `?Dev` | Callable ? change l?e-mail d?une invite parent pending (+ r�elign guardian pending) |
| `extendGuardianInvite` / `?Dev` | Callable ? prolonge l?expiration d?une invite parent |
| `regenerateGuardianInvite` / `…Dev` | Callable — nouveau code + reset expiration + renvoi e-mail Brevo |
| `setEventRsvp` / `setEventRsvpDev` | Callable ? RSVP pour soi ou un enfant li� |
| `createStripeConnectLink` / `?Dev` | Callable ? onboarding Connect (Accounts v2 Express + Account Link) |
| `getStripeConnectStatus` / `?Dev` | Callable ? rafra�chit le statut Connect du club |
| `createStripeCheckout` / `?Dev` | Callable ? PaymentIntent destination charge + aides |
| `stripeWebhook` / `stripeWebhookDev` | HTTP ? cr�dite `amountPaidCents` apr�s `payment_intent.succeeded` |
| `createHelloAssoCheckout` / `?Dev` | Callable ? cr�e un checkout HelloAsso (1�/3� + aides) ? dormant |
| `helloAssoWebhook` / `helloAssoWebhookDev` | HTTP ? cr�dite cotisation HelloAsso ? dormant |
| `lookupInvitationByCode` / `?Dev` | Callable **sans auth** ? retrouve une invitation pending par code (e-mail masqu� `emailHint`, jamais l?e-mail complet) |
| `deleteMyAccount` / `deleteMyAccountDev` | Callable ? anonymise les fiches du compte (cascade tol�rante aux erreurs) puis supprime le compte Auth |
| `setMemberRole` / `setMemberRoleDev` | Callable ? admin du club change un r�le (garde � dernier admin �, sync `adminIds` + `clubMemberships`) |
| `removeMember` / `removeMemberDev` | Callable ? admin du club retire un membre (garde � dernier admin �, rosters, invitation ? `revoked`, `member_accounts`) |
| `onTeamWritten` / `onTeamWrittenDev` | Trigger Firestore `clubs/{clubId}/teams/{teamId}` ? recalcule `users/{uid}.parentTeamIds` des parents des joueurs ajout�s/retir�s + sync chats `team` / `parents` |
| `createCoachDm` / `?Dev` | Callable ? cr�e une DM / groupe coaches (joueurs & parents ? coaches/admins uniquement) |
| `createCategoryChannel` / `?Dev` | Callable admin ? canal cat�gorie (�criture admin par d�faut) |
| `ensureClubChatSynced` / `?Dev` | Callable ? backfill idempotent chats syst�me d?un club (�quipes d�j� cr��es) |
| `backfillMyAdminClubChats` / `?Dev` | Callable ? backfill de tous les clubs o� l?appelant est admin |
| `onMemberWrittenForChat` / `?Dev` | Trigger membres ? sync chats `staff` + `club` |
| `onClubWrittenForChat` / `?Dev` | Trigger club ? resync si `adminIds` change |
| `onChatMessageCreatedForPush` / `?Dev` | Trigger message ? push 1 notif / message (mute + pref `chat`) |
| `scheduleSeasonChatPurge` / `?Dev` | Cron 03:00 Europe/Paris ? purge messages si `seasonEndDate` dans les 48 h (Storage conserv�) |
| `registerFcmToken` / `?Dev` | Callable ? enregistre un token FCM (`users/{uid}/fcmTokens`) |
| `unregisterFcmToken` / `?Dev` | Callable ? supprime un token FCM |
| `sendEventPush` / `?Dev` | Callable ? notif manuelle event (coach/admin, 1/h) |
| `onEventWrittenForPush` / `?Dev` | Trigger events ? cr�ation (rappels imm�diats), annul� / report� / modifi� |
| `onAnnouncementCreatedForPush` / `?Dev` | Trigger annonces ? push � la publication |
| `scheduleEventReminders` / `?Dev` | Cron Lun?Ven 18:30 Europe/Paris ? rappels J-7 / J-2 |
| `scheduleFeeReminders` / `?Dev` | Cron lundi 19:00 Europe/Paris ? rappels cotisation |

**Environnements** : sans suffixe ? Firestore `v2-prod` ; suffixe `Dev` ? `v2-dev`.
L?app Flutter (`cloudCallableName`) et le portail (`NEXT_PUBLIC_FIRESTORE_DATABASE_ID`) choisissent le bon nom.

**Mails Brevo (persona Guy)** — module `src/email/` :
- `memberInvite` (joueur / coach / admin) via `sendMemberInvites`
- `guardianInvite` via `inviteGuardian` / `regenerateGuardianInvite` (soft-fail si Brevo échoue)
- `inviteAcceptedMember` / `inviteAcceptedGuardian` à l'inviteur (`sentBy`) via `acceptInvitation` / `linkGuardian`

Layout : logo **club** (`logoUrl`) en body, logo **app** ViroTeam en footer. Expéditeur affiché : `Guy · ViroTeam` (`noreply@viroteam.com`).
Le partage manuel (WhatsApp / SMS) reste disponible côté app / portail.
Les docs `invitations` `type: guardian` sont créés **uniquement** via `inviteGuardian` (rules : create/accept client interdits).

## Secrets / params

```bash
# Stripe (test = v2-dev / *Dev ; live = v2-prod)
firebase functions:secrets:set STRIPE_SECRET_KEY_TEST
firebase functions:secrets:set STRIPE_PUBLISHABLE_KEY_TEST
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_TEST
# Placeholders acceptables tant que la prod n'est pas branch�e :
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
firebase functions:secrets:set STRIPE_PUBLISHABLE_KEY_LIVE
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_LIVE

# HelloAsso (dormant ? multi-prestataire futur)
firebase functions:secrets:set HELLOASSO_CLIENT_ID
firebase functions:secrets:set HELLOASSO_CLIENT_SECRET
firebase functions:secrets:set HELLOASSO_WEBHOOK_TOKEN   # jeton al�atoire long ; vide ? webhook d�sactiv� (503)
firebase functions:secrets:set BREVO_API_KEY
# optionnel (params / .env)
# HELLOASSO_API_BASE=https://api.helloasso.com
# (sandbox : https://api.helloasso-sandbox.com)
# BREVO_SENDER_EMAIL=noreply@viroteam.com
# BREVO_SENDER_NAME=Guy · ViroTeam
# INVITE_JOIN_BASE_URL=https://www.viroteam.com
```

Brevo : domaine `viroteam.com` authentifié + expéditeur `noreply@viroteam.com` (nom affiché Guy · ViroTeam).

**Stripe Connect** : chaque club onboarde un compte Express via le portail (`createStripeConnectLink`). Champs club : `stripeConnectedAccountId`, `stripeConnectStatus`, `onlinePaymentEnabled`.

Webhooks Stripe (Dashboard ? Developers ? Webhooks) :
- `stripeWebhookDev` ? events `payment_intent.succeeded`, `account.updated` (cl�s test)
- `stripeWebhook` ? idem (cl�s live)

Sur chaque club (HelloAsso dormant) : champ `helloAssoOrganizationSlug`.

Webhook HelloAsso : coller l?URL de `helloAssoWebhook` **suffix�e `?token=<HELLOASSO_WEBHOOK_TOKEN>`** dans HelloAsso ? Mon Compte ? Int�grations et API (types Order + Payment).
Tant qu?aucun secret n?est configur�, le webhook r�pond 503.

Re�us PDF : stock�s dans `receipts/{clubId}/{seasonId}/?` (bucket priv�, plus de `makePublic`) ; `member_fees.receiptUrl` est une **URL sign�e valable 1 h** (le compte de service des functions doit avoir le r�le *Service Account Token Creator* pour signer).

`parentTeamIds` : maintenu **uniquement** c�t� serveur (`linkGuardian`, `revokeGuardian`, `updateGuardianInviteEmail`, trigger `onTeamWritten`) via `recomputeParentTeamIds` (`src/parentTeams.ts`).

## Setup

```bash
cd functions
npm install
npm run build
# Sur Windows le discovery peut d�passer 10s : augmenter le timeout
# PowerShell :
$env:FUNCTIONS_DISCOVERY_TIMEOUT=60
firebase deploy --only functions
```

Un `firebase deploy --only functions` pousse **toutes** les callables duales (`acceptInvitation` + `acceptInvitationDev`, etc.).

## D�ploiement CI

Taguer depuis `main` vert. Workflow : [`.github/workflows/deploy-functions.yml`](../.github/workflows/deploy-functions.yml).

| D�clencheur | Environment GitHub | Effet |
|-------------|-------------------|--------|
| Tag `functions-dev-v1.2.3` | `firebase-dev` | Deploy all functions (dual) |
| Tag `functions-v1.2.3` | `firebase-prod` | Deploy all functions (dual) |
| **Actions ? Deploy functions ? Run workflow** (`dev` / `prod`) | idem | Idem sans tag |

Secret requis : `FIREBASE_SERVICE_ACCOUNT_DEPLOY` (voir [`SETUP_LOCAL.md`](../SETUP_LOCAL.md)).  
Les secrets runtime (Brevo, HelloAsso) restent g�r�s via `firebase functions:secrets`, pas via GitHub Actions.

```bash
git tag functions-dev-v1.0.0 && git push origin functions-dev-v1.0.0
git tag functions-v1.0.0 && git push origin functions-v1.0.0
```

**Important** : le `returnUrl` client ne doit jamais marquer une cotisation `paye`.
## Backfill clubs existants (chat)

Apr?s d?ploiement des Functions chat, les clubs qui avaient d?j? des ?quipes n?ont pas encore de docs `conversations`. Deux options :

1. **Automatique** ? ouvrir l??cran Discussions dans l?app (appelle `ensureClubChatSynced` pour chaque club de la session).
2. **Admin** ? callable `backfillMyAdminClubChats` / `?Dev` pour synchroniser tous les clubs o? tu es dans `adminIds`.

Les upserts sont idempotents (`systemKey`).
