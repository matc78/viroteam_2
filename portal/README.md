# Portail web ViroTeam

Site public (landing marketing) + dashboard admin (Auth Firebase + Firestore).  
Stack : **Next.js** (App Router) + TypeScript + CSS Modules + Firebase JS SDK.

## Démarrer

```bash
cd portal
cp .env.local.example .env.local   # déjà prérempli pour viroteam-75303
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## Firebase

Même projet que l’app mobile : **`viroteam-75303`**.

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_FIREBASE_*` | Config web (voir `lib/firebase_options.dart`) |
| `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` | `v2-dev` (local) ou `v2-prod` (prod) |

**Important** : jamais la base Firestore default — toujours `v2-dev` / `v2-prod` (miroir `appFirestore` Flutter).

### Dev local — connexion sans limite

En local (`NEXT_PUBLIC_DEV_AUTH_BYPASS=true`, activé dans `.env.local.example`), la connexion e-mail passe par un **custom token** Admin SDK au lieu de `signInWithEmailAndPassword`, ce qui évite l’erreur Firebase `auth/too-many-requests`.

Credentials Admin (une des deux options) :

1. **Compte de service** dans `.env.local` : `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` (Console Firebase → Paramètres → Comptes de service → Générer une nouvelle clé privée).
2. **ADC** : `gcloud auth application-default login` (compte Google avec droits Admin sur le projet).

Le mot de passe saisi n’est **pas vérifié** en mode dev bypass — seul l’e-mail doit exister dans Firebase Auth. Désactiver avec `NEXT_PUBLIC_DEV_AUTH_BYPASS=false` ou en prod (`v2-prod`).

### Accès

- Login / signup via **Firebase Auth** (email + mot de passe).
- Dashboard (`/home`, `/fees`) : uniquement si `clubMemberships` contient un club avec `role === admin`.
- Joueur / coach / sans club admin → `/access-denied` (message + stores + déconnexion).
- Création de club : **app mobile uniquement**.

## Routes

| Route | Contenu |
|-------|---------|
| `/` | Landing marketing |
| `/login` | Connexion Firebase |
| `/signup` | Inscription + profil `users/{uid}` |
| `/access-denied` | Accès refusé non-admin |
| `/home` | Home dashboard (agrégats Firestore) |
| `/fees` | Cotisations : saison + HelloAsso (lecture/écriture) |

## Liens stores

Configurés dans [`src/lib/site.ts`](src/lib/site.ts) :

- **Google Play** : actif (`com.viroteam.viro_team_v2`)
- **App Store** : « Bientôt » jusqu’à publication

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build production
- `npm run start` — servir le build
- `npm run lint` — ESLint

## Déploiement (Firebase App Hosting)

Prod : backend App Hosting **`portal`**, Firestore **`v2-prod`**, région **`europe-west4`**.  
Config runtime : [`apphosting.yaml`](apphosting.yaml). Déploiement **uniquement** via tag `portal-v*` (pas à chaque push sur `main`).

### Prérequis une fois (console)

1. **Blaze** sur `viroteam-75303` : [passer en Blaze](https://console.firebase.google.com/project/viroteam-75303/overview?purchaseBillingPlan=metered).
2. **Budget 5 € / mois** : [Google Cloud → Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets) — budget mensuel **5 EUR** sur le projet, alertes e-mail à **50 % / 90 % / 100 %**.  
   Ce n’est **pas** un hard cap (couper la facturation tuerait aussi Auth/Firestore de l’app mobile).
3. **Backend App Hosting** (Firebase console → App Hosting → Create) :
   - Nom / backendId : `portal`
   - Repo GitHub du monorepo
   - Root directory : `portal`
   - Live branch : `main`
   - **Désactiver les rollouts automatiques** (sinon chaque push sur `main` déploierait)
   - App web Firebase : `1:396501317680:web:93d4f0b325ff9c876fd5f5`
4. **Secret GitHub** `FIREBASE_SERVICE_ACCOUNT_PORTAL` : clé JSON d’un compte de service GCP avec droits pour créer des rollouts App Hosting (ex. rôle *Firebase App Hosting Admin* / équivalent sur le projet).

### Publier une version

```bash
git tag portal-v0.1.0
git push origin portal-v0.1.0
```

Le workflow [`.github/workflows/deploy-portal.yml`](../.github/workflows/deploy-portal.yml) lance  
`firebase apphosting:rollouts:create portal --git-commit <sha>`.  
Redeploy manuel : **Actions → Deploy portal → Run workflow**.

URL live : console App Hosting → backend `portal` (sous-domaine `*.hosted.app`).

## Thème

Tokens alignés sur l’app Flutter (`ViroColors`) : bleu profond `#134A7D`. Fond blanc + formes décoratives globales (`DecorShapes`). Typo : Inter (comme l’app).

**Tones dashboard** (dans [`src/app/globals.css`](src/app/globals.css)) :

| Tone | Usage typique | Badges |
|------|---------------|--------|
| `blue` | Saison / info | `.badge-blue` |
| `amber` | Tarifs / attention | `.badge-amber` |
| `green` | Hors ligne / succès | `.badge-green` |
| `orange` | HelloAsso / action | `.badge-orange` |

Sur une carte : `data-tone="amber"` (bordure + fond + chips héritent du tone).
