# Spec — Portail web ViroTeam + allègement mobile

**Statut** : cadrage  
**Stack site** : React (site public + dashboard)  
**Backend** : même Firebase Auth + Firestore (`v2-dev` / `v2-prod`) + Cloud Functions que l’app  
**Spec liée** : [`viroteam_v2_payments_helloasso_spec.md`](viroteam_v2_payments_helloasso_spec.md)

---

## 1. Objectifs

### Portail web
1. **Site public** — présenter l’app et ses fonctionnalités (modèle apps sportives type SportEasy / TeamApp).
2. **Connexion** — même compte que l’app → dashboard club.
3. **Dashboard bureau** — suivi membres / cotisations, config HelloAsso, inventaire équipements, droits coachs.

### App mobile (ajustement)
Garder le **terrain** et les **actions urgentes / simples**. Déplacer le **pilotage bureau** (tableaux, config lourde) vers le web.

---

## 2. Décisions figées (MVP)

| Sujet | Décision |
|-------|----------|
| Pricing / abonnement | **Non** — phase de test / bêta |
| Tournois / événements lourds | **Hors scope** — prochaine partie |
| Rôle `owner` | **N’existe pas** (créateur = `admin`) |
| Rôle `treasurer` | **Pas encore** — au MVP, **tout admin = trésorier** (droits finance + HelloAsso) |
| Accès dashboard web | `role == admin` uniquement |
| Équipements | Inventaire **simple** (CRUD) ; prêts / retours plus tard |
| Stack | **React** (entraînement) + Firebase |

### Évolution prévue (post-MVP)
- Rôle Firestore dédié `treasurer` (finance / HelloAsso sans être super-admin club).
- Module tournois / événements majeurs sur le web.
- Prêts / retours équipements.
- Pricing éventuel après la phase de test.

---

## 3. Principes mobile vs web

| | **App mobile** | **Dashboard web (React)** |
|---|---|---|
| Public | Joueur, coach, parent ; admin en déplacement | Bureau : admin (= trésorier MVP) |
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
| `/` | Landing : marque, promesse, CTA (créer un club / se connecter / stores) |
| `/features` | Modules : équipes, planning / RSVP, cotisations HelloAsso, invitations, présences |
| `/login` | Connexion Firebase → redirect dashboard si admin |
| `/legal/*` | CGU, confidentialité |

Landing : une composition claire, brand fort, pas de faux dashboard marketing.  
CTA : stores + « Espace club ».

---

## 5. Auth & garde d’accès

1. Login Firebase Auth (même projet que l’app).
2. Charger `clubs/{clubId}/members/{uid}` (ou memberships user).
3. Si `role != admin` → message « Réservé aux administrateurs du club » + lien vers l’app.
4. Si plusieurs clubs admin → sélecteur de club puis dashboard.
5. Rules Firestore : writes dashboard = admin (comme aujourd’hui) ; pas d’élargissement coach/joueur.

---

## 6. Dashboard — modules MVP

### 6.1 Vue club
KPIs : nb membres, cotisations `paye` / `partiel` / `a_payer`, aides `pending_proof`, prochains événements (lecture).

### 6.2 Membres
Liste filtrable (rôle, équipe, statut cotisation), invitation, changement de rôle (`player` / `coach` / `admin`).  
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
- `canTakeAttendance`
- `canViewFees` (lecture — défaut non)

Stockage proposé :
- `clubs/{clubId}.coachPermissions` (defaults club)
- override optionnel plus tard sur `members/{uid}.permissions`

---

## 7. Rôles (état actuel + MVP)

Rôles Firestore inchangés au MVP :

```
player | coach | admin
```

Hiérarchie actuelle : Admin ⊃ Coach ⊃ Player.  
Parent = relation (`parentLinks`), pas un rôle club.  
Pas d’`owner`.

**MVP finance** : tout `admin` a les droits trésorier (cotisations, HelloAsso, dashboard web).

**Post-MVP** : introduire `treasurer` comme rôle dédié (finance sans gestion complète du club).

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

L’écran admin cotisations mobile devient une **vue opérationnelle légère**, avec un lien / message du type « Pour la configuration complète, utilisez l’espace club sur le web » (quand le portail est en prod).

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
- Dashboard web pour coach / joueur
- Prêts / retours équipements
- Multi-prestataires paiement

---

## 10. Critères de succès MVP

- Un admin se connecte sur le web et pilote cotisations + HelloAsso sans Excel.
- Un non-admin ne peut pas entrer dans le dashboard.
- L’inventaire simple est utilisable sur le web.
- Les droits coachs se configurent sur le web et s’appliquent dans l’app.
- Sur mobile, l’admin gère surtout les urgences cotisations / membres, pas la config lourde.

---

## 11. Questions reportées (post-MVP)

1. Introduire `treasurer` : droits exacts vs admin (HelloAsso only ? inventaire ?).
2. Visibilité mobile des événements majeurs quand le module web existera.
3. Freemium / pricing après la phase de test.
