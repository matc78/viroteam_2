# Portail web ViroTeam

Site public (landing marketing) + futur dashboard admin.  
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
| `/login` | Stub « connexion bientôt » (pas d’auth Firebase pour l’instant) |

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

Tokens alignés sur l’app Flutter (`ViroColors`) : bleu profond `#134A7D`, fonds clairs en dégradé. Typo : Sora (titres) + Source Sans 3 (corps).
