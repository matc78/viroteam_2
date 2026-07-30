# Spec — Paiements hybrides cotisations (HelloAsso)

**Statut** : implémentation v1  
**Prestataire CB** : HelloAsso (Checkout Intent API v5)  
**Décision** : validation cotisation **uniquement** via webhook serveur → serveur, jamais via `returnUrl` client.

---

## 1. Objectifs

Les clubs encaissent rarement 100 % en CB. Le système doit gérer :

| Mode | Description |
|------|-------------|
| CB HelloAsso | Paiement en 1× ou 3× (échéances HelloAsso) |
| Aides / réductions | Pass'Sport, Pass+, ANCV, code promo, montant libre → part « hors CB » en attente de justificatif |
| Hors-ligne | Trésorier valide chèque, espèces, chèques-vacances, virement |

Exemple : cotisation **180 €** + Pass'Sport **50 €** → checkout HelloAsso **130 €** ; **50 €** en `pending_proof` jusqu’à validation admin.

---

## 2. Modèle `member_fees/{memberId}`

Champs existants conservés (`status`, `tierId`, `paidAt`, `markedBy`, `paidVia`, …).

### Nouveaux / étendus

| Champ | Type | Rôle |
|-------|------|------|
| `amountPaidCents` | int | Somme confirmée (webhook CB + hors-ligne) |
| `aids` | array | Aides déclarées (voir §2.1) |
| `installmentCount` | int? | `1` ou `3` au dernier checkout |
| `offlineMethod` | string? | `cheque` \| `especes` \| `ancv` \| `virement` \| `cheques_vacances` |
| `receiptUrl` | string? | PDF Storage après encaissement réussi |
| `checkoutIntentId` | string? | Dernier intent HelloAsso |
| `externalOrderId` | string? | Order HelloAsso |

### Statuts `status`

- `a_payer` — rien (ou aides seules non validées) côté encaissement
- `partiel` — CB / hors-ligne partiel, ou CB OK + aide encore `pending_proof`
- `paye` — reste dû ≤ 0 (CB + aides **validées** + hors-ligne)
- `exonere`

**Règle de calcul** (côté app + Functions) :

```
due = tier.amountCents (0 si exonéré)
covered = amountPaidCents + sum(aids where status == validated)
remaining = max(0, due - covered)
```

`paye` ⇔ `remaining == 0` (sauf exonéré).

### 2.1 Aide (`aids[]`)

| Champ | Type |
|-------|------|
| `id` | string |
| `type` | `pass_sport` \| `pass_plus` \| `ancv` \| `promo` \| `other` |
| `label` | string |
| `amountCents` | int |
| `promoCode` | string? |
| `status` | `pending_proof` \| `validated` \| `rejected` |
| `createdAt` | timestamp |
| `validatedBy` / `validatedAt` | optionnels |

### 2.2 Session de checkout

`clubs/{clubId}/fee_seasons/{seasonId}/payment_sessions/{sessionId}`

Créée par la callable **avant** redirection HelloAsso. Contient `memberId`, montants, `aids`, `installmentCount`, `checkoutIntentId`, `status: pending|completed|failed`. Le webhook résout la session via `metadata.sessionId`.

---

## 3. Flux HelloAsso

```
App → createHelloAssoCheckout (callable)
    → OAuth client_credentials (+ refresh stocké)
    → POST /organizations/{slug}/checkout-intents
    → écrit payment_sessions + aids pending sur member_fee
    → renvoie redirectUrl
App → url_launcher(redirectUrl)
Utilisateur paie sur HelloAsso
returnUrl → écran « confirmation en cours » (ne marque PAS payé)
Webhook Payment/Order → Admin SDK met à jour amountPaidCents / status
                     → génère PDF reçu → receiptUrl
```

### Échéances 3×

Body checkout : `initialAmount` + `terms[]` (montant + date).  
Contraintes HelloAsso : max 1 échéance / mois, pas après le 27, 1ʳᵉ échéance ≠ mois courant, max 12 mois.  
`totalAmount` = somme initial + terms = montant CB uniquement (après aides).

### Club

`clubs/{clubId}.helloAssoOrganizationSlug` — slug orga HelloAsso.

Secrets Functions (params) : `HELLOASSO_CLIENT_ID`, `HELLOASSO_CLIENT_SECRET`, `HELLOASSO_API_BASE` (prod ou sandbox).

---

## 4. Webhook

- Endpoint HTTP `helloAssoWebhook` (remplace le stub générique).
- Traite `eventType` **Payment** (Authorized) et **Order** ; ignore le reste ou log.
- **Ne fait confiance qu’au corps webhook** (et métadonnées session), pas au returnUrl.
- Idempotent : si `externalPaymentId` déjà appliqué, 200 OK sans double crédit.
- Base Firestore : `v2-dev` / `v2-prod` (jamais default).

---

## 5. Hors-ligne (trésorier)

Admin uniquement (rules existantes) :

- Choisit le moyen (`offlineMethod`)
- `amountPaidCents` couvre le reste (ou montant saisi)
- `paidVia: offline`, `status: paye` si reste 0
- Option : générer reçu PDF via callable `generateFeeReceipt`

Validation justificatif aide : `aids[i].status → validated|rejected` puis recalcul statut.

---

## 6. Reçu PDF

Généré côté Functions dès encaissement CB confirmé (et optionnellement hors-ligne).  
Stockage : `receipts/{clubId}/{seasonId}/{memberId}_{timestamp}.pdf`  
Champ `receiptUrl` sur `member_fees`.

---

## 7. Règles de sécurité

- Client **ne peut pas** passer `status` à `paye` via un retour web.
- Marquage CB : Admin SDK dans le webhook uniquement.
- Création checkout : callable authentifiée, vérifie membership / ownership.
- Hors-ligne + validation aides : write admin Firestore (déjà en place).

---

## 8. Hors scope v1

- Multi-prestataires simultanés (Stripe)
- Upload photo justificatif (statut texte + note suffit en v1)
- SEPA HelloAsso
- Remboursements automatiques
