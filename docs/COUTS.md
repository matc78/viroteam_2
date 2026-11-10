# Suivi des coûts — ViroTeam

Inventaire des services payants (ou potentiellement payants), ce qui est **automatique** (alertes) vs **manuel** (saisie mensuelle), et le rituel pour ne pas se faire surprendre.

Le suivi mois par mois est ci-dessous (lisible dans le markdown). Le fichier [`couts_mensuel.csv`](couts_mensuel.csv) sert d’export Sheets (séparateur `,`, décimales en `.`).

## Verdict automatisation

Une agrégation auto de toutes les factures (APIs billing PostHog, Sentry, Brevo, stores…) n’est pas rentable à notre échelle. On combine :

1. **Alertes natives** chez chaque vendor (surtout GCP / Firebase)
2. **Saisie mensuelle** dans le CSV / Sheet (~10 min)

Si Firebase / GCP dépasse souvent le budget, on pourra ajouter plus tard un export Billing → BigQuery. Pas maintenant.

## Coût plateforme vs frais clubs

| | Quoi | Dans le tableau ? |
|---|---|---|
| **Plateforme ViroTeam** | Firebase/GCP, PostHog, Sentry, Brevo, GitHub, Apple, Play, Appfigures… | Oui |
| **Stripe Connect** | Commissions / frais carte sur les cotisations des clubs | Non — coût du club (ou du payeur), pas un abonnement ViroTeam. Suivi via Stripe Dashboard / PostHog cotisations si besoin |

## Inventaire

| Service | Rôle | Où voir la facture / l’usage | Facturation typique | Auto |
|---|---|---|---|---|
| **Firebase / GCP** | Auth, Firestore (`v2-dev` / `v2-prod`), Storage, Functions, FCM, Crashlytics, App Hosting | [Firebase](https://console.firebase.google.com/project/viroteam-75303) · [Cloud Billing](https://console.cloud.google.com/billing) | À l’usage (free tier puis €) | Budget + e-mail (cible **5 €/mois**) |
| **PostHog** (UE) | Analytics app + portail + events serveur | [eu.posthog.com](https://eu.posthog.com) › Organization › Billing | Pay-as-you-go, **1 M events / mois** gratuits | E-mails / alertes plan |
| **Sentry** | Erreurs portail | [sentry.io](https://sentry.io) › Settings › Subscription | Plan **Developer** (5 k erreurs / mois) | Alertes quota / facture |
| **Brevo** | E-mails (invitations, Guy) | [app.brevo.com](https://app.brevo.com) › facturation | Offre **Gratuit** (300 e-mails / jour) | E-mails de facture |
| **GitHub Actions** | CI, releases, deploys | Repo › Settings › Billing / Actions | Minutes gratuites (compte perso) | Spending limit si payant |
| **Apple Developer** | TestFlight / App Store | [developer.apple.com](https://developer.apple.com/account) | **99 € / an** quand activé | Non — **pas payé pour l’instant** ; passer la colonne `apple` à ~8.25 le mois où l’abo démarre |
| **Google Play Console** | Publication Android | [play.google.com/console](https://play.google.com/console) | **25 $ one-shot** — **déjà payé** | Non — `play_prorata_eur` = **0** |
| **Appfigures** | Stats stores (optionnel) | [appfigures.com](https://appfigures.com) | Free souvent suffisant | Non |

Crashlytics est inclus côté Firebase ; pas de ligne séparée.

## État au 10 nov. 2026 (relevé consoles)

| Service | Montant / usage | Commentaire |
|---|---|---|
| GCP octobre | **1,67 €** | Dont Secret Manager ~0,58 € (stockage réplicas) ; +0,72 € vs sept. |
| GCP novembre | **0,09 €** MTD · prévi **~1,40 €** | Bien sous le budget 5 €. |
| PostHog | **0 $** | ~2,5 k events / 1 M free (cycle au 23). |
| Sentry | **0 $** | Developer ; 2 / 5 k erreurs. |
| Brevo | **0 €** | Offre gratuite. |
| GitHub | **0 $** | Aucun paiement. |
| Play | **0 €/mois** | Frais d’inscription déjà réglés. |
| Apple | **0 €/mois** | Pas d’abo Developer pour l’instant (à revoir pour Store / TestFlight). |

### Mois par mois (EUR)

Montants en euros. Play déjà payé → 0. Apple pas d’abo → 0. Les autres à 0 = free tier.

| Mois | GCP | PostHog | Sentry | Brevo | GitHub | Apple | Play | Autre | **Total** | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 2026-10 | 1.67 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1.67** | Secret Manager ~0.58 ; +76 % vs sept |
| 2026-11 | 0.09 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.09** | MTD au 10/11 (prévi GCP ~1.40) |

Source fichier : [`couts_mensuel.csv`](couts_mensuel.csv).

## Checklist alertes (une fois)

À cocher dans les consoles (on ne peut pas les activer depuis le repo) :

- [ ] **GCP** — Budget ~5 €/mois sur le compte lié à `viroteam-75303` ; seuils e-mail **50 % / 90 % / 100 %** ([Cloud Billing › Budgets](https://console.cloud.google.com/billing))
- [ ] **PostHog** — notifications de plan / limite d’événements (Organization › Billing)
- [ ] **Sentry** — alertes de quota d’erreurs / abo (Settings › Subscription)
- [ ] **Brevo** — e-mails de facturation et seuil de crédits restants
- [ ] **GitHub** — spending limit Actions si le compte est payant ; sinon surveiller les minutes gratuites

## Rituel mensuel (~10 min)

1. Ouvre Cloud Billing (mois en cours / précédent) → note la colonne `firebase_gcp`.
2. PostHog, Sentry, Brevo, GitHub → note chaque montant (0 si free / inclus).
3. Ajoute une ligne dans le tableau ci-dessus **et** dans [`couts_mensuel.csv`](couts_mensuel.csv) : Play = **0** ; Apple = **0** tant que l’abo n’est pas pris, sinon ~**8.25**.
4. Calcule `total` (somme des colonnes de montants).
5. Une phrase dans `notes` si un poste a doublé ou si une alerte a sonné.

Pas besoin d’attendre la fin du mois civil : le 1er–5 du mois suivant suffit (factures souvent calées ainsi).

## Quand monter d’un cran

- Alertes GCP répétées au-delà de 5 € → regarder Functions / Firestore / App Hosting dans la console, puis envisager export Billing.
- PostHog ou Sentry proches du plafond free → optimiser le volume d’events / sampling avant de payer.