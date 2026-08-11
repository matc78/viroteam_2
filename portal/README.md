# Portail web ViroTeam

Site public (landing marketing) + dashboard admin (home mock).  
Stack : **Next.js** (App Router) + TypeScript + CSS Modules.

## Démarrer

```bash
cd portal
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## Routes

| Route | Contenu |
|-------|---------|
| `/` | Landing marketing |
| `/login` | Formulaire connexion (UI seule, pas d’auth Firebase) |
| `/signup` | Formulaire inscription (UI seule) |
| `/home` | Home dashboard admin (données mock) |

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
