# Suite déploiement — checklist manuelle

Tout ce qui **nécessite ton intervention** (comptes, secrets, DNS, stores, contenu légal).  
Le code / docs automatisables sont déjà traités dans le repo ; l’ordre ci-dessous cible **Android + portail d’abord**, puis iOS ([`DEPLOY_IOS.md`](DEPLOY_IOS.md)).

Taguer **uniquement depuis `main` vert** (CI full matrix OK).

---

## 0. Avant tout tag

- [ ] `main` vert sur GitHub Actions
- [ ] Changelog figé pour la version (ex. `1.1.0` dans `CHANGELOG.md` + `pubspec.yaml`)
- [ ] Pages légales déployables : placeholders mentions légales remplacés (voir section Légal)
- [ ] Domaine `www.viroteam.com` pointe vers le portail (sinon invitations / privacy URL cassées)

---

## 1. Infra / secrets (une fois)

Voir aussi [`SETUP_LOCAL.md`](../SETUP_LOCAL.md).

### GitHub Actions — secrets repo

| Secret | Usage |
|--------|--------|
| `ANDROID_KEYSTORE_BASE64` | Release Android |
| `ANDROID_KEY_PROPERTIES` | Release Android (`storeFile=app/upload-keystore.jks`) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Upload Play (tags `v*` / `release-v*`) |
| `FIREBASE_SERVICE_ACCOUNT_PORTAL` | Rollout App Hosting (`portal-v*`) |
| `FIREBASE_SERVICE_ACCOUNT_DEPLOY` | Functions + Firestore |

### Environments GitHub

| Environment | Workflows |
|-------------|-----------|
| `play-store` | Release Android → Play |
| `firebase-dev` | Deploy functions / firestore (dev) |
| `firebase-prod` | Portal + functions / firestore (prod) — reviewers recommandés |

### App Hosting

- [ ] Secret `SENTRY_AUTH_TOKEN` côté Firebase App Hosting (référencé dans [`portal/apphosting.yaml`](../portal/apphosting.yaml))
- [ ] Backend `portal`, rollouts **non** automatiques sur chaque push `main`
- [ ] `NEXT_PUBLIC_DEV_AUTH_BYPASS` **absent** en prod (déjà le cas dans `apphosting.yaml`)

### Cloud Functions secrets

```bash
firebase functions:secrets:set BREVO_API_KEY
# Plus tard (HelloAsso live) :
# firebase functions:secrets:set HELLOASSO_CLIENT_ID
# firebase functions:secrets:set HELLOASSO_CLIENT_SECRET
```

Params / `.env` : `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `INVITE_JOIN_BASE_URL` — voir [`functions/README.md`](../functions/README.md).

---

## 2. DNS et e-mail

- [ ] Custom domain `www.viroteam.com` → Firebase App Hosting (backend `portal`)
- [ ] Redirect `viroteam.com` → `www` (ou inverse, une seule canonical)
- [ ] SPF / DKIM Brevo pour `noreply@viroteam.com` (domaine authentifié)
- [ ] Boîtes (ou alias) `contact@viroteam.com` et `privacy@viroteam.com` (liens dans CGU / privacy)
- [ ] Budget GCP / alertes (ex. 5 €/mois) — voir README Dashboards

---

## 3. Déploiements prod (ordre recommandé)

Valider d’abord en **dev**, puis **prod** :

```bash
# 1 — Rules / indexes
git tag firestore-dev-v1.1.0 && git push origin firestore-dev-v1.1.0
# Smoke test app debug (v2-dev)

git tag firestore-v1.1.0 && git push origin firestore-v1.1.0

# 2 — Functions (inclut acceptInvitation, guardians, Brevo, HelloAsso stubs)
git tag functions-dev-v1.1.0 && git push origin functions-dev-v1.1.0
# Smoke test callables Dev

git tag functions-v1.1.0 && git push origin functions-v1.1.0

# 3 — Portail
git tag portal-v1.1.0 && git push origin portal-v1.1.0

# 4 — Android Play internal + GitHub Release
git tag v1.1.0 && git push origin v1.1.0

# 5 — Android Play production (quand internal OK)
git tag release-v1.1.0 && git push origin release-v1.1.0
```

Alternatives : **Actions → workflow_dispatch** (cible `dev` / `prod`) pour Functions / Firestore / portal ; Release Android manuel = artifacts seuls.

Déployer aussi **Storage rules** si modifié :

```bash
firebase deploy --only storage
```

(Pas encore de workflow CI dédié storage — manuel ou à ajouter.)

---

## 4. Google Play Console

Package : `com.viroteam.viro_team` (même que v1).

- [ ] Data Safety : Auth (email/Google), calendrier, photos (logo club), analytics **sans** AD_ID
- [ ] URL confidentialité : `https://www.viroteam.com/legal/privacy`
- [ ] Captures, description courte / longue, icône / feature graphic
- [ ] Questionnaire contenu / public cible
- [ ] Track **internal** via tag `v*` puis **production** via `release-v*`
- [ ] Vérifier que le manifeste release n’a pas les permissions interdites (déjà checké en CI Release)

---

## 5. Légal à compléter (toi)

Pages template dans le portail :

| Page | Action |
|------|--------|
| `/legal/mentions` | Remplacer `{{À COMPLÉTER}}` (raison sociale, SIRET, siège, directeur de publication, hébergeur si besoin) |
| `/legal/privacy` | Valider sous-traitants + identité du responsable de traitement |
| `/legal/cgu` | Valider contact / responsabilité éditeur |

- [ ] Ne pas inventer de SIRET : texte juridique réel avant prod publique
- [ ] DPA / contrats sous-traitants si clubs pros le demandent
- [ ] (Optionnel) CMP cookies plus formel si trafic UE important — bannière minimale PostHog déjà en place

---

## 6. iOS

Suivre intégralement [`DEPLOY_IOS.md`](DEPLOY_IOS.md) (compte Apple, Firebase plist, Google Sign-In, TestFlight, App Store).

---

## 7. Produit — suite (non bloquant v1.1)

| Item | Notes |
|------|--------|
| **HelloAsso live** | Partenariat → secrets Functions → `helloAssoPaymentsLive = true` (app) + `NEXT_PUBLIC_HELLOASSO_LIVE=true` (portail) → slug orga par club |
| Upload photo justificatif d’aide | Backlog Phase 7 |
| FCM / push rappels | Backlog Phase 8 |
| App Check | Hardening post-MVP |
| Workflow CI iOS | Optionnel (certs Apple en secrets) |
| 2ᵉ parent / dark mode / i18n | Hors scope immédiat (`ROADMAP.md`) |

Flags paiement CB restent à `false` tant que le partenariat n’est pas clos — le hors-ligne / manuel fonctionne.

---

## 8. Smoke test post-déploiement

### Portail (`v2-prod`)

- [ ] Landing + login / signup
- [ ] Bureau admin / coach / joueur
- [ ] Espace famille parent
- [ ] `/legal/*` accessibles
- [ ] Join `/join?code=`

### App Android release

- [ ] Auth email + Google
- [ ] Accepter invitation (callable `acceptInvitation`)
- [ ] Planning RSVP, cotisations hors-ligne
- [ ] Profil : liens légaux + suppression de compte
- [ ] Crashlytics / PostHog (pas de mode DEBUG)

### Functions

- [ ] `sendMemberInvites` (Brevo) reçoit bien les mails
- [ ] Guardians callables
- [ ] (Plus tard) HelloAsso checkout + webhook

---

## Références

- iOS : [`DEPLOY_IOS.md`](DEPLOY_IOS.md)
- Secrets locaux : [`SETUP_LOCAL.md`](../SETUP_LOCAL.md)
- CI / tags : [`README.md`](../README.md)
- Roadmap : [`ROADMAP.md`](ROADMAP.md)
- Portail : [`portal/README.md`](../portal/README.md)
- Functions : [`functions/README.md`](../functions/README.md)
