# Changelog — Portail ViroTeam

Trace des déploiements Firebase App Hosting (tags `portal-v*`).

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versions alignées sur les tags Git (`portal-vX.Y.Z`).

Avant chaque tag `portal-v*` : déplacer les entrées `[Unreleased]` vers la nouvelle section versionnée.

## [Unreleased]

## [1.4.4] - 2026-09-22

### Ajouté

- Fichier clé IndexNow à la racine (`/{key}.txt`) pour Bing Webmaster

### Corrigé

- Balises `canonical` sur les pages légales (`/legal/cgu`, `/privacy`, `/mentions`) pour lever le « Duplicate without user-selected canonical » Search Console

### Modifié

- Messages d’invitation WhatsApp alignés sur la voix Guy (partage)

## [1.4.3] - 2026-09-18

### Modifié

- Meta SERP raccourcie ; H1 landing crawlable pour Bing

## [1.4.2] - 2026-09-18

### Corrigé

- `prefer-const` dans `chatService` (échec lint CI)

## [1.4.1] - 2026-09-18

### Note

- Tag de redéploiement (même commit que `1.4.0`)

## [1.4.0] - 2026-09-18

### Ajouté

- Messagerie in-app portail (types, service, callables, thread, dock, sondages, réactions, réponses, panel infos, deep links)
- SEO landing : sitemap XML, `robots.txt` élargi, JSON-LD, FAQ marketing, redirect apex → `www`
- Activation roster et import membres sans e-mail obligatoire

### Modifié

- Reverse proxy PostHog et DSN Sentry EU
- Logo Play Store aux couleurs officielles

### Sécurité / flags

- Messagerie masquée en prod (`NEXT_PUBLIC_CHAT_MESSAGING_LIVE` absent d’App Hosting) jusqu’à release store

## [1.3.1] - 2026-09-12

### Note

- Alignement suite app `2.2.x` (Stripe, push, planning) — voir changelog monorepo

## [1.3.0] - 2026-09-12

### Note

- Déploiement portail aligné release app `2.2.0`

## [1.2.0] - 2026-09-08

### Note

- Déploiement portail (tag `portal-v1.2.0`)

## [1.1.0] - 2026-08-27

### Note

- Déploiement portail (tag `portal-v1.1.0`)

## [0.4.0] - 2026-08-21

### Note

- Déploiement portail (tag `portal-v0.4.0`)

## [0.3.0] - 2026-08-19

### Note

- Déploiement portail (tag `portal-v0.3.0`)

## [0.2.0] - 2026-08-19

### Ajouté

- PostHog, Sentry et Firebase Analytics

## [0.1.0] - 2026-08-13

### Ajouté

- Premier déploiement App Hosting via tags `portal-v*`
