# Cloud Functions ViroTeam

Logique sensible hors client (HelloAsso, invitations). Spec paiement :
[`docs/specs/viroteam_v2_payments_helloasso_spec.md`](../docs/specs/viroteam_v2_payments_helloasso_spec.md).

## Contenu

| Function | Rôle |
|----------|------|
| `acceptInvitation` / `acceptInvitationDev` | Callable — accepter une invitation **membre** (refuse `type: guardian`) ; mail confirmation à l'inviteur (Guy / Brevo, soft-fail) |
| `sendMemberInvites` / `sendMemberInvitesDev` | Callable — e-mails d'invitation membre via Brevo (voix Guy, variantes player/coach/admin) |
| `inviteGuardian` / `inviteGuardianDev` | Callable — admin ou titulaire invite un parent (plafond V1 = 1) + e-mail Brevo auto |
| `linkGuardian` / `linkGuardianDev` | Callable — active guardian + `parentLinks` ; mail confirmation à l'inviteur (soft-fail) |
| `revokeGuardian` / `revokeGuardianDev` | Callable — révoque le lien parent (purge `parentLinks`) |
| `updateGuardianInviteEmail` / `…Dev` | Callable — change l’e-mail d’une invite parent pending (+ réelign guardian pending) |
| `extendGuardianInvite` / `…Dev` | Callable — prolonge l’expiration d’une invite parent |
| `regenerateGuardianInvite` / `…Dev` | Callable — nouveau code + reset expiration + renvoi e-mail Brevo |
| `setEventRsvp` / `setEventRsvpDev` | Callable — RSVP pour soi ou un enfant lié |
| `createStripeConnectLink` / `…Dev` | Callable — onboarding Connect (Accounts v2 Express + Account Link) |
| `getStripeConnectStatus` / `…Dev` | Callable — rafraîchit le statut Connect du club |
| `createStripeCheckout` / `…Dev` | Callable — PaymentIntent destination charge + aides |
| `stripeWebhook` / `stripeWebhookDev` | HTTP — crédite `amountPaidCents` après `payment_intent.succeeded` |
| `createHelloAssoCheckout` / `…Dev` | Callable — crée un checkout HelloAsso (1×/3× + aides) — dormant |
| `helloAssoWebhook` / `helloAssoWebhookDev` | HTTP — crédite cotisation HelloAsso — dormant |
| `lookupInvitationByCode` / `…Dev` | Callable **sans auth** — retrouve une invitation pending par code (e-mail masqué `emailHint`, jamais l’e-mail complet) |
| `deleteMyAccount` / `deleteMyAccountDev` | Callable — anonymise les fiches du compte (cascade tolérante aux erreurs) puis supprime le compte Auth |
| `setMemberRole` / `setMemberRoleDev` | Callable — admin du club change un rôle (garde « dernier admin », sync `adminIds` + `clubMemberships`) |
| `removeMember` / `removeMemberDev` | Callable — admin du club retire un membre (garde « dernier admin », rosters, invitation → `revoked`, `member_accounts`) |
| `onTeamWritten` / `onTeamWrittenDev` | Trigger Firestore `clubs/{clubId}/teams/{teamId}` — recalcule `users/{uid}.parentTeamIds` des parents des joueurs ajoutés/retirés + sync chats `team` / `parents` |
| `createCoachDm` / `…Dev` | Callable — crée une DM / groupe coaches (joueurs & parents → coaches/admins uniquement) |
| `createCategoryChannel` / `…Dev` | Callable admin — canal catégorie (écriture admin par défaut) |
| `ensureClubChatSynced` / `…Dev` | Callable — backfill idempotent chats système d’un club (équipes déjà créées) |
| `backfillMyAdminClubChats` / `…Dev` | Callable — backfill de tous les clubs où l’appelant est admin |
| `onMemberWrittenForChat` / `…Dev` | Trigger membres — sync chats `staff` + `club` |
| `onClubWrittenForChat` / `…Dev` | Trigger club — resync si `adminIds` change |
| `onChatMessageCreatedForPush` / `…Dev` | Trigger message — push 1 notif / message (mute + pref `chat`) |
| `scheduleSeasonChatPurge` / `…Dev` | Cron 03:00 Europe/Paris — purge messages si `seasonEndDate` dans les 48 h (Storage conservé) |
| `registerFcmToken` / `…Dev` | Callable — enregistre un token FCM (`users/{uid}/fcmTokens`) |
| `unregisterFcmToken` / `…Dev` | Callable — supprime un token FCM |
| `sendEventPush` / `…Dev` | Callable — notif manuelle event (coach/admin, 1/h) |
| `onEventWrittenForPush` / `…Dev` | Trigger events — création (rappels immédiats), annulé / reporté / modifié |
| `onAnnouncementCreatedForPush` / `…Dev` | Trigger annonces — push à la publication |
| `scheduleEventReminders` / `…Dev` | Cron Lun–Ven 18:30 Europe/Paris — rappels J-7 / J-2 |
| `scheduleFeeReminders` / `…Dev` | Cron lundi 19:00 Europe/Paris — rappels cotisation |

**Environnements** : sans suffixe → Firestore `v2-prod` ; suffixe `Dev` → `v2-dev`.
L’app Flutter (`cloudCallableName`) et le portail (`NEXT_PUBLIC_FIRESTORE_DATABASE_ID`) choisissent le bon nom.

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
# Placeholders acceptables tant que la prod n'est pas branchée :
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
firebase functions:secrets:set STRIPE_PUBLISHABLE_KEY_LIVE
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_LIVE

# HelloAsso (dormant — multi-prestataire futur)
firebase functions:secrets:set HELLOASSO_CLIENT_ID
firebase functions:secrets:set HELLOASSO_CLIENT_SECRET
firebase functions:secrets:set HELLOASSO_WEBHOOK_TOKEN   # jeton aléatoire long ; vide ⇒ webhook désactivé (503)
firebase functions:secrets:set BREVO_API_KEY
# optionnel (params / .env)
# HELLOASSO_API_BASE=https://api.helloasso.com
# (sandbox : https://api.helloasso-sandbox.com)
# BREVO_SENDER_EMAIL=noreply@viroteam.com
# BREVO_SENDER_NAME=Guy · ViroTeam
# INVITE_JOIN_BASE_URL=https://www.viroteam.com
# CHAT_MESSAGING_LIVE=false   # push chat coupés tant que la messagerie est cachée
```

**`CHAT_MESSAGING_LIVE`** (param public `defineBoolean`, défaut `false`) : tant qu'il vaut
`false`, `onChatMessageCreatedForPush` maintient les compteurs non-lus mais n'envoie
**aucun** push `chat_message`. Le workflow CI l'écrit à `false` dans
`functions/.env.viroteam-75303` ; le jour où la messagerie est ouverte aux clubs, passer
la ligne à `true` dans [`deploy-functions.yml`](../.github/workflows/deploy-functions.yml)
(ou dans le `.env` local) et redéployer.

## Décisions sécurité (lot 2, 28 sept. 2026)

- **Checkout Stripe** (`createStripeCheckout`) : le montant et la devise du client ne font
  plus foi. Devise forcée à `eur` (toute autre valeur → `invalid-argument`) ; reste dû
  recalculé depuis `member_fees` (palier dû − `amountPaidCents` − aides `validated`) ;
  montant encaissé = `min(montant client, reste dû)`, donc un paiement partiel reste
  possible mais jamais un dépassement. Aides déclarées : 10 max, montants bornés au reste
  dû, et fusionnées sans doublon par session (`mergeFeeAids`). Le webhook ignore (et
  logge) tout `payment_intent.succeeded` dont la devise n'est pas `eur`. Helpers purs et
  testés dans `src/stripeCheckoutUtils.ts`. HelloAsso (dormant) n'a pas été touché.
- **Chats système** : `onMemberWrittenForChat` ne relance `syncClubWideConversations`
  que si `role` / `status` / `accountUid` / `userId` / `teamIds` changent
  (`memberChatFieldsChanged`), et `upsertSystemConversation` ne réécrit pas une
  conversation dont participants (triés), titre, politique et cibles sont identiques.
- **`createCategoryChannel`** : `writePolicy` ∈ {`open`, `admins_only`,
  `coaches_and_admins`}, `title` ≤ 80, admin résolu via `assertClubAdmin` (adminIds,
  index `member_accounts` ou fiche directe).
- Les règles Firestore / Storage correspondantes (fiches lisibles par un parent, rename,
  création de message bornée, médias image dans le bucket du projet) sont commentées en
  tête de `firestore.rules` et de `storage.rules`. Les Storage rules ne peuvent pas lire
  les bases nommées v2-dev / v2-prod (`firestore.get` ne voit que `(default)`) : pas de
  contrôle d'appartenance au club possible à l'upload, seulement le segment uid.

Brevo : domaine `viroteam.com` authentifié + expéditeur `noreply@viroteam.com` (nom affiché Guy · ViroTeam).

**Stripe Connect** : chaque club onboarde un compte Express via le portail (`createStripeConnectLink`). Champs club : `stripeConnectedAccountId`, `stripeConnectStatus`, `onlinePaymentEnabled`.

Webhooks Stripe (Dashboard → Developers → Webhooks) :
- `stripeWebhookDev` → events `payment_intent.succeeded`, `account.updated` (clés test)
- `stripeWebhook` → idem (clés live)

Sur chaque club (HelloAsso dormant) : champ `helloAssoOrganizationSlug`.

Webhook HelloAsso : coller l’URL de `helloAssoWebhook` **suffixée `?token=<HELLOASSO_WEBHOOK_TOKEN>`** dans HelloAsso → Mon Compte → Intégrations et API (types Order + Payment).
Tant qu’aucun secret n’est configuré, le webhook répond 503.

Reçus PDF : stockés dans `receipts/{clubId}/{seasonId}/…` (bucket privé, plus de `makePublic`) ; `member_fees.receiptUrl` est une **URL signée valable 1 h** (le compte de service des functions doit avoir le rôle *Service Account Token Creator* pour signer).

`parentTeamIds` : maintenu **uniquement** côté serveur (`linkGuardian`, `revokeGuardian`, `updateGuardianInviteEmail`, trigger `onTeamWritten`) via `recomputeParentTeamIds` (`src/parentTeams.ts`).

## Setup

```bash
cd functions
npm install
npm run build
# Sur Windows le discovery peut dépasser 10s : augmenter le timeout
# PowerShell :
$env:FUNCTIONS_DISCOVERY_TIMEOUT=60
firebase deploy --only functions
```

Un `firebase deploy --only functions` pousse **toutes** les callables duales (`acceptInvitation` + `acceptInvitationDev`, etc.).

## Déploiement CI

Taguer depuis `main` vert. Workflow : [`.github/workflows/deploy-functions.yml`](../.github/workflows/deploy-functions.yml).

| Déclencheur | Environment GitHub | Effet |
|-------------|-------------------|--------|
| Tag `functions-v1.2.3` | `firebase-prod` | Deploy all functions (dual) |
| **Actions → Deploy functions → Run workflow** | idem | Idem sans tag |

Un seul tag par version : chaque déploiement pousse déjà les variantes `*Dev` et prod. Le workflow est sérialisé (`concurrency`), deux déploiements ne tournent jamais en même temps.

Secret requis : `FIREBASE_SERVICE_ACCOUNT_DEPLOY` (voir [`SETUP_LOCAL.md`](../SETUP_LOCAL.md)).  
Les secrets runtime (Brevo, HelloAsso) restent gérés via `firebase functions:secrets`, pas via GitHub Actions.

```bash
git tag functions-v1.0.0 && git push origin functions-v1.0.0
```

**Important** : le `returnUrl` client ne doit jamais marquer une cotisation `paye`.

## Backfill clubs existants (chat)

Après déploiement des Functions chat, les clubs qui avaient déjà des équipes n’ont pas encore de docs `conversations`. Deux options :

1. **Automatique** — ouvrir l’écran Discussions dans l’app (appelle `ensureClubChatSynced` pour chaque club de la session).
2. **Admin** — callable `backfillMyAdminClubChats` / `…Dev` pour synchroniser tous les clubs où tu es dans `adminIds`.

Les upserts sont idempotents (`systemKey`).
