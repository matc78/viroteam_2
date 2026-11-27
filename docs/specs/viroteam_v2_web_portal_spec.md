# Spec — Portail web ViroTeam + allègement mobile

**Statut** : cadrage  
**Stack site** : React (site public + dashboard)  
**Backend** : même Firebase Auth + Firestore (`v2-dev` / `v2-prod`) + Cloud Functions que l’app  
**Specs liées** : [`viroteam_v2_payments_helloasso_spec.md`](viroteam_v2_payments_helloasso_spec.md), [`viroteam_v2_parents_spec.md`](viroteam_v2_parents_spec.md)

---

## 1. Objectifs

### Portail web
1. **Site public** — présenter l’app et ses fonctionnalités (modèle apps sportives type SportEasy / TeamApp).
2. **Connexion** — même compte que l’app → dashboard bureau (admin / coach / joueur adapté) ou espace famille (parent).
3. **Dashboard bureau** — suivi membres / cotisations (admin), vues équipes (coach), planning / RSVP (joueur), inventaire équipements, droits coachs.
4. **Espace famille** — planning / RSVP / cotisation payeur pour les enfants liés (voir spec parents). Hors MVP bureau actuel ; prévu Phase 8.

### App mobile (ajustement)
Garder le **terrain** et les **actions urgentes / simples**. Déplacer le **pilotage bureau** (tableaux, config lourde) vers le web.

---

## 2. Décisions figées (MVP)

| Sujet | Décision |
|-------|----------|
| Pricing / abonnement | **Non** — phase de test / bêta |
| Tournois / événements lourds | **Hors scope** — prochaine partie |
| Modèle d’accès | **Droits purs** : `members/{uid}.permissions` (11 droits) + relation coach d’équipe — pas de rôle stocké ([spec droits](viroteam_v2_permissions_spec.md)) |
| Trésorier | Droit `manageFees` (fonction « Responsable cotisations »), attribuable à n’importe quel membre ; Stripe Connect reste au droit `admin` |
| Accès dashboard **bureau** | Une fiche `members/{uid}` dans le club — pages et actions filtrées par les droits (`useBureauCapabilities`) |
| Accès espace **famille** | `parentLinks` actifs (guardian) — Phase 8 ; spec parents |
| Équipements | Inventaire **simple** (CRUD) ; prêts / retours plus tard |
| Stack | **React** (entraînement) + Firebase |

### Évolution prévue (post-MVP bureau)
- Espace famille parent (Phase 8) — même stack, garde et nav distinctes.
- Rôle Firestore dédié `treasurer` (finance / HelloAsso sans être super-admin club).
- Module tournois / événements majeurs sur le web.
- Prêts / retours équipements.
- Pricing éventuel après la phase de test.

---

## 3. Principes mobile vs web

| | **App mobile** | **Dashboard web (React)** |
|---|---|---|
| Public | Joueur, coach, parent ; admin en déplacement | Bureau : admin (cockpit), coach / joueur (vues adaptées). Famille : parent (Phase 8) |
| UI | Écrans courts, actions rapides | Tableaux, filtres, config |
| Cotisations admin | Vue légère (voir retards, relancer, hors-ligne ponctuel) | Cockpit complet + HelloAsso |
| Membres | Ajouter / inviter un oublié, gestes simples | Liste riche, filtres, export |
| Inventaire | Non (MVP) | Oui |
| Droits coachs | Lecture des flags (masquer actions) | Édition de la matrice |
| Dashboard KPIs | Non | Oui |

**Règle** : si ça ressemble à un tableur ou une config rare → **web**.  
Si c’est « sur le terrain / maintenant » → **mobile**.

---

## 4. Site public (React)

Sans page pricing.

| Route | Contenu |
|-------|---------|
| `/` | Landing : marque, promesse, CTA (créer un club / se connecter / stores). Modules détaillés via ancres (`#planning`, `#membres`, `#cotisations`, …) — pas de page `/features` séparée. |
| `/login` | Connexion Firebase → bureau si admin/coach/joueur, espace famille si guardian, sinon access-denied / onboarding |
| `/legal/cgu`, `/legal/privacy` | CGU, confidentialité |

Landing : une composition claire, brand fort, pas de faux dashboard marketing.  
CTA : stores + « Espace club ».

---

## 5. Auth & garde d’accès

1. Login Firebase Auth (même projet que l’app).
2. Charger `users/{uid}` : `memberClubIds` + `parentLinks`.
3. Si `memberClubIds` non vide → espace **bureau** (sélecteur de club si plusieurs). L’UI et les actions dépendent des droits de la fiche dans le **club actif** (`useBureauCapabilities`, spec [`viroteam_v2_permissions_spec.md`](viroteam_v2_permissions_spec.md)).
4. Si `parentLinks` actifs → espace **famille** (Phase 8). Spec : [`viroteam_v2_parents_spec.md`](viroteam_v2_parents_spec.md).
5. Sinon (aucun club / aucun parentLink) → access-denied ou onboarding join.
6. Bureau **et** parent → sélecteur d’espace (Bureau ↔ Famille), navs non mélangées.
7. Rules Firestore : lecture club pour tout membre ; chaque écriture exige le droit concerné (`can()`) ou, pour un coach, la relation avec l’équipe et le réglage `clubs/{clubId}.coachPermissions` (`coachCan()`). Les droits eux-mêmes ne s’écrivent que via la callable `setMemberPermissions` (droit `admin`).
   Événements : un coach ne modifie / annule / notifie / convoque que s’il **entraîne toutes les équipes** de l’événement et que l’événement n’est pas « tout le club » (`allTeams`) ; RSVP d’autrui : coach d’au moins une équipe, jamais sur « tout le club ». Le droit `manageEvents` garde tout.

### Matrice Bureau (club actif)

Chaque zone suit un **droit**, cumulable ; le droit `admin` les accorde tous. Le coach agit en plus sur **ses** équipes (`members/{uid}.coachTeamIds`) selon les réglages `coachPermissions`. Sans droit ni équipe entraînée : vue membre / joueur.

| Zone | Avec le droit | Coach (ses équipes) | Sans droit |
|------|---------------|---------------------|------------|
| Nav | Selon les droits (`navHrefs`) | Membres, Planning, Annonces (si `canPublishTeamAnnouncements`) | Home, Équipe, Planning, Cotisations |
| Scope données | Club entier avec `manageMembers`, `manageTeams` ou `manageEvents` | Ses équipes | Ses équipes / convocations |
| Contacts | Complets avec `manageMembers` | Pas d’email/tél des autres | Email/tél des coachs de ses équipes uniquement |
| Membres | `manageMembers` (fiches, invitations, parents) ; import CSV : `manageMembers` + `manageTeams` | Ajout joueur (`canManageTeamRoster`), invitation (`canInvitePlayers`), licence (`canEditMemberLicenses`) | Lecture seule (ses équipes) |
| Planning | `manageEvents` | Création si `canCreateEvents` ; gestion d’un événement dont il entraîne toutes les équipes (jamais « tout le club ») | Son planning + RSVP |
| Cotisations | `manageFees` (config, suivi, actions groupées) ; `viewFees` (lecture) ; Stripe Connect : `admin` | — | Sa fiche (sinon « rien à faire » / « déjà payé ») |
| Annonces | `manageAnnouncements` | Ciblage de ses équipes | Pas de page ; bandeau sur Home |
| Équipements | `manageEquipment` | — | Masqué |
| Paramètres | `manageClubSettings` (infos club) ; réglages coach et droits : `admin` | — | Son compte |

Accueil : vue club avec un droit qui voit tout le club ou `viewFees` (blocs cotisations / journal selon `viewFees` / `viewActivity`) ; sinon vue de ses équipes s’il en entraîne ; sinon vue joueur.

---

## 6. Dashboard — modules MVP

### 6.1 Vue club
KPIs : nb membres, cotisations `paye` / `partiel` / `a_payer`, aides `pending_proof`, prochains événements (lecture).

### 6.2 Membres
Liste filtrable (badge, équipe, statut cotisation), invitation, attribution des droits (bascule Administrateur, fonctions, droits à la carte — droit `admin` seul ; jamais ses propres droits ; toujours au moins un admin).  
Export CSV (nice-to-have MVP).

### 6.3 Cotisations
- Saison active, paliers, consignes, IBAN.
- Tableau membres + montants + aides + hors-ligne.
- Validation aides / justificatifs.
- Synthèse encaissé CB vs hors-ligne vs aides.

Source de vérité : modèle hybride HelloAsso (webhook seul pour valider CB).

### 6.4 HelloAsso (admin = trésorier)
- Brancher / afficher slug orga, statut connexion.
- Derniers paiements / sessions.
- Pas de secrets client exposés en clair (credentials côté Functions / secrets).

### 6.5 Équipements (inventaire simple)

`clubs/{clubId}/equipment/{itemId}`

| Champ | Type | Exemple |
|-------|------|---------|
| `name` | string | Ballon match |
| `category` | string | ballons |
| `quantity` | int | 12 |
| `condition` | string | `ok` \| `use` \| `hs` |
| `location` | string? | Local U14 |
| `assignedTeamId` | string? | |
| `notes` | string? | |
| `updatedAt` / `updatedBy` | | |

Pas de flux prêt / retour au MVP.

### 6.6 Droits coachs (features app)

Matrice par club (defaults) ; l’app mobile lit les flags pour masquer / bloquer.

Exemples de flags :
- `canCreateEvents`
- `canManageTeamRoster`
- `canInvitePlayers`
- `canEditMemberRsvp`
- (`canViewFees` est devenu le droit club `viewFees`, attribuable à n’importe quel membre)

Stockage : `clubs/{clubId}.coachPermissions` (mêmes réglages pour tous les coachs du club, modifiables par le droit `admin`). Les droits club d’une personne vivent à part, dans `members/{uid}.permissions`.

---

## 7. Droits et badges

Plus de rôle stocké : spec de référence [`viroteam_v2_permissions_spec.md`](viroteam_v2_permissions_spec.md).

- **Droits** : `members/{uid}.permissions` (11 droits, catalogue `shared/permissions_catalog.json`), écrits uniquement par les Functions. `admin` implique tous les autres et permet seul d’attribuer des droits ; `manageFees` implique `viewFees`. Les « fonctions » (Responsable cotisations, membres, sportif…) ne sont que des raccourcis d’attribution.
- **Coach d’équipe** : relation `teams.coachIds` (dérivée en `members/{uid}.coachTeamIds`), capacités réglées par `clubs.coachPermissions`.
- **Parent** : relation (`guardians` + `parentLinks`) — spec [`viroteam_v2_parents_spec.md`](viroteam_v2_parents_spec.md).
- **Badges** (affichage seulement, jamais une autorisation) : Admin > Entraîneur > Joueur > Membre, plus Parent (membre sans droit admin ni équipe mais avec un lien parent dans le club). Portail : `derivedBadges` / `primaryBadge` (`src/lib/auth/permissions.ts`), libellés `src/lib/copy/badgeCopy.ts`.
- Point d’entrée portail : `useBureauCapabilities()` ; helpers par équipe / événement dans `src/lib/auth/permissions.ts`.

---

## 8. Modifications app mobile

### 8.1 Cotisations admin — allègement

**Garder sur mobile (urgent / simple)**  
- Voir qui n’a pas payé / est en `partiel`.
- Rappeler à l’ordre (liste claire des retards).
- Marquer un paiement hors-ligne ponctuel (si déjà en place).
- Accès rapide « Ma cotisation » côté joueur inchangé (payer via HelloAsso).

**Déplacer / réduire sur mobile (faire sur le web)**  
- Config saison complète (création saison, grille tarifaire détaillée).
- Paramétrage HelloAsso / orga.
- Validation massive d’aides, synthèse comptable.
- Gros tableaux / exports.

L’écran admin cotisations mobile devient une **vue opérationnelle légère** (`Suivi cotisations`), avec bannière et lien vers l’espace club sur le web pour la configuration complète.

**HelloAsso (état actuel)**  
- Config orga (slug) : **portail uniquement** (`/fees`), toggle désactivé tant que le partenariat n’est pas actif.  
- Paiement CB membre : masqué dans l’app (`helloAssoPaymentsLive = false`) ; message « bientôt disponible ».  
- Activation : flip `FeatureFlags.helloAssoPaymentsLive` (app) + `NEXT_PUBLIC_HELLOASSO_LIVE=true` (portail) après partenariat et déploiement des secrets Functions.

### 8.2 Membres
Conserver : inviter / ajouter un membre oublié, gestes simples.  
Le suivi riche reste web.

### 8.3 Inventaire & droits coachs
Pas d’UI mobile MVP pour l’inventaire.  
Les flags coachs sont **consommés** par l’app (masquage d’actions), **édités** uniquement sur le web.

### 8.4 Hors scope mobile (inchangé)
Tournois / championnats restent retirés du mobile (Phase 1 roadmap).

---

## 9. Hors scope MVP (rappel)

- Page pricing / abonnement
- Tournois & événements lourds
- Rôle `treasurer` distinct
- Rôle `owner`
- Mode « vue coach » séparée pour un admin (les droits du club actif suffisent)
- Prêts / retours équipements
- Multi-prestataires paiement
- 2ᵉ parent / grands-parents (schéma prêt, plafond V1 = 1)

---

## 10. Critères de succès MVP

- Un admin se connecte sur le web et pilote cotisations + HelloAsso sans Excel.
- Un coach / joueur entre dans le bureau avec pages et actions filtrées (scope équipes).
- Un parent (Phase 8) entre dans l’espace famille, pas dans les KPI / config HelloAsso.
- L’inventaire simple est utilisable sur le web.
- Les droits coachs se configurent sur le web et s’appliquent dans l’app comme dans les règles Firestore (`coachCan()`).
- Sur mobile, l’admin gère surtout les urgences cotisations / membres, pas la config lourde.

---

## 11. Questions reportées (post-MVP)

1. Introduire `treasurer` : droits exacts vs admin (HelloAsso only ? inventaire ?).
2. Visibilité mobile des événements majeurs quand le module web existera.
3. Freemium / pricing après la phase de test.
