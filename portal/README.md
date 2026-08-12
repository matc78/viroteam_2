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
