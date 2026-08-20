# Spec — Parents (relation, pas rôle)

**Statut** : cadrage V1  
**Specs liées** : [`viroteam_v2_firestore_model.md`](viroteam_v2_firestore_model.md), [`viroteam_v2_web_portal_spec.md`](viroteam_v2_web_portal_spec.md), [`viroteam_v2_invitation_only_model.md`](viroteam_v2_invitation_only_model.md), [`viroteam_v2_fees_spec.md`](viroteam_v2_fees_spec.md)  
**Constantes** : `lib/config/project_config.dart`, `lib/constants/firestore_fields.dart`

---

## 1. Objectif produit

Un adulte suit **ses enfants** (planning, RSVP, cotisation, annonces) avec **son** compte. L’enfant n’a pas besoin d’e-mail ni de mot de passe en V1.

La majorité des parents ne sont pas licenciés du club : un seul écran famille, sans switcher de rôle. Si l’adulte est aussi joueur / coach / admin dans le même club, un segment **Moi | prénom enfant** choisit **pour qui** on agit — ce n’est pas un 4ᵉ rôle Firestore.

---

## 2. Décisions figées

| Sujet | Décision |
|-------|----------|
| Nature | Relation adulte ↔ fiche joueur, **pas** `members.role` |
| Identité du lien | `(parentUid, clubId, memberId)` — `memberId` de l’enfant, pas son Auth uid |
| Source de vérité | `clubs/{clubId}/members/{memberId}/guardians/{parentUid}` |
| Index session | `users/{parentUid}.parentLinks[]` (`clubId`, `memberId`, `relation`, `status`) |
| Écriture | Les deux faces via Cloud Function / transaction — jamais un seul côté client |
| V1 adultes / enfant | **1** guardian `active` ou `pending` (`maxActiveGuardiansPerMember = 1`) |
| V1 enfants / adulte | **N** (liste dès le départ) |
| Invitation | Admin **ou titulaire de la fiche** (compte lié), `type: guardian`, e-mail |
| Login partagé | **Non** — chaque adulte a son compte Auth |
| Relais ado | Hors V1 — l’enfant lie son Auth sur la **même** fiche (`accountUid`) |
| Liste admin | Sous-onglet Parents dans Membres (portail + app) : invitations + parents connectés |
| Révocation | Soft sur `guardians` ; **retrait** de l’entrée `parentLinks` + recalcul `parentClubIds` |
| Self-manage joueur | Compte lié : inviter / révoquer **son** parent depuis l’app |

Schéma déjà N:N : 2ᵉ parent / grands-parents = lever le plafond + champ `relation`, pas de migration.

---

## 3. Modèle de données

```
users/{parentUid}                          ← compte Auth de l’adulte
  parentLinks[]                            ← index session (dénormalisé)
    { clubId, memberId, relation, status }

clubs/{clubId}/members/{memberId}          ← fiche licencié (enfant)
  /guardians/{parentUid}                   ← source de vérité du lien
```

### 3.1 Document `guardians/{parentUid}`

| Champ | Type | V1 |
|-------|------|-----|
| `parentUid` | string | uid Auth de l’adulte |
| `clubId` | string | |
| `memberId` | string | fiche enfant |
| `relation` | string | toujours `parent` |
| `status` | string | `pending` \| `active` \| `revoked` |
| `permissions.canView` | bool | `true` |
| `permissions.canRsvp` | bool | `true` |
| `permissions.canPay` | bool | `true` |
| `invitedBy` | string | uid admin |
| `createdAt` / `revokedAt` | timestamp | |

Clé document = `parentUid` : un 2ᵉ adulte = un 2ᵉ doc. Interdit de lier `parentUid` à **sa propre** fiche (`memberId` dont `accountUid == parentUid`).

### 3.2 `users/{uid}.parentLinks[]`

Même rôle que `clubMemberships` : au login, le portail / l’app lit **ce** document pour savoir quels clubs famille ouvrir, sans collection group.

Forme cible : `{ clubId, memberId, relation, status }`.  
Le champ legacy `childUid` (scan actuel `fetchClubParents`) n’est **pas** l’identité du lien ; à remplacer à l’implémentation.

### 3.3 Pourquoi pas un rôle club

- L’adulte n’est pas au roster, n’a pas *sa* cotisation enfant, n’est pas convoqué.
- Admin ⊃ Coach ⊃ Player casserait si `parent` était collé dans la hiérarchie.
- Même compte : parent de N enfants **et** joueur / coach / admin ailleurs (ou dans le même club).
- Révocation = `revokedAt` / delete du guardian, sans toucher aux membres.
- Mineur sans compte : la fiche `members/{memberId}` existe déjà ; le payeur a un Auth, pas une licence.

---

## 4. Invitation (V1)

Ne pas réutiliser une invitation joueur avec `role: parent`.

```
clubs/{clubId}/invitations/{inviteId}
  type: "guardian"
  memberId: "<fiche enfant>"
  email: "parent@…"
  relation: "parent"
  status: pending | accepted | …
```

Flux :

1. Admin **ou titulaire de la fiche** → **Inviter un parent** (e-mail), depuis la fiche joueur, la liste Parents, ou « Mon parent » (app).
2. V1 : refuser s’il existe déjà un guardian `active` ou `pending`.
3. L’adulte crée **son** compte (ou se connecte).
4. Callable `linkGuardian` / acceptation : écrit `guardians/{parentUid}` **et** l’entrée `parentLinks`.
5. Si l’e-mail a déjà un compte **licencié du même club** : on **ajoute le lien**, on ne crée pas de membre, on ne change pas le `role`.

Callables invite / revoke / update mail / extend / regenerate : autorisées pour **admin club** ou **`accountUid` de la fiche**.

Révocation : `guardians.status = revoked` ; sur `users/{parentUid}` on **retire** l’entrée `parentLinks` pour `(clubId, memberId)` (pas de soft-status) et on recalcule `parentClubIds`.

Copy invitation : *« Tu pourras voir le planning de Marie, répondre aux convocations et payer la cotisation. »*

---

## 5. UX — le plus simple possible

Vocabulaire UI : **parent**, **enfant**, **Moi | Marie**. Pas « guardian », pas « casque », pas « rôle parent ».

### 5.1 Parent seul (cas majoritaire)

Après login, accueil famille (app **et** portail) :

- Prochain événement de l’enfant + RSVP Oui / Peut-être / Non
- Bandeau cotisation si due
- Annonces club / équipe
- Tuiles : Planning, Cotisation, Infos

Un enfant : pas de sélecteur. Plusieurs enfants : puces **Marie | Lucas**.

Pas de liste membres, pas de KPI club, pas d’éditeur de droits.

### 5.2 Licencié + parent (même club)

Segment **Moi | Marie** (visible seulement si les deux faits existent) :

- **Moi** → écran club actuel (planning / cotisation de **sa** fiche)
- **Marie** → accueil famille, actions sur `memberId` de Marie

Admin + parent : l’espace **bureau** (KPI, config cotisations, membres) reste **séparé** (tuile / portail déjà en place). On ne mélange pas les KPI et le RSVP de l’enfant.

### 5.3 Cible des actions

RSVP, checkout HelloAsso, lecture planning : toujours un `memberId` **explicite** (moi ou l’enfant). Pas de calendrier fusionné séniors + U10 en V1.

---

## 6. Portail web

Garde d’accès après login :

1. `clubMemberships` avec `role == admin` → espace **bureau** (inchangé).
2. `parentLinks` actifs → espace **famille** (accueil, planning, cotisation payeur, RSVP).
3. Les deux sur le même club → sélecteur d’espace, navs non mélangées.
4. Joueur / coach sans enfant et sans admin → pas le bureau (message + lien app, comme aujourd’hui).

L’espace famille n’est **pas** le dashboard KPI. Routes bureau (`/members`, config HelloAsso, inventaire) restent admin-only.

Sous-onglet **Parents** dans Membres (bureau) : liste filtrable des invitations pending et parents connectés (1 ligne = 1 parent, N enfants), actions révoquer / changer mail (pending) / prolonger / renvoyer / copier. Le bloc Parent de la fiche membre est conservé.

---

## 7. Paiement et RSVP

- Cotisation : docs `member_fees/{memberId de l’enfant}`. Le parent paie **pour** l’enfant.
- Checkout HelloAsso : callable avec `memberId` cible ; le serveur vérifie `cible == moi` **ou** guardian `active` avec `canPay`.
- RSVP : clé `events.rsvp[memberId]` de l’enfant si guardian `active` + `canRsvp` (aujourd’hui les rules ne permettent que la clé du connecté — à élargir à l’implémentation).
- Aides / justificatifs / reçu : vue payeur parent (c’est l’adulte qui gère Pass’Sport, etc.).

---

## 8. Hors V1

- 2ᵉ parent, grands-parents (`relation: grandparent` \| `tutor`), droits différents par adulte
- Compte Auth de l’enfant ; relais : poser `accountUid`, puis retirer `canRsvp` au parent
- Planning fusionné multi-cibles
- Push / e-mail dédiés parents (FCM reste backlog)
- Changement d’e-mail Auth d’un parent **actif**

---

## 9. Anti-patterns

- `members/{id}.role = 'parent'` ou entrée `clubMemberships` parent
- `members/{id}.parentUid` scalaire (bloque le 2ᵉ adulte)
- Lier sur l’Auth uid de l’enfant (mineur sans compte)
- Login / mot de passe partagé « compte de l’enfant »
- Plafond V1 dans la **forme** des données (un champ unique) plutôt que `maxActiveGuardiansPerMember`
- Invitation joueur avec `role: parent`

---

## 10. Critères de succès V1 (implémentation ultérieure)

- Un admin invite un parent sur une fiche joueur ; l’adulte se connecte et voit **uniquement** cet enfant.
- Un parent avec deux enfants voit les deux (puces), sans 2ᵉ compte.
- Un licencié du club invité comme parent garde son `role` ; il bascule Moi / enfant.
- Un non-admin sans `parentLinks` n’entre pas dans le dashboard bureau.
- Impossible d’ajouter un 2ᵉ parent tant que le cap V1 est à 1.
- Liste Parents (portail + app) : invitations + connectés, révocation purge `parentLinks`.
- Joueur avec compte lié : invite / révoque son parent depuis « Mon parent ».

---

*Dernière mise à jour : août 2026*
