# Analytics produit — ViroTeam

Comment on mesure l'usage, où regarder et à quel rythme. Le plan de taggage officiel (la liste de ce qu'on mesure) est dans [`analytics_events.csv`](analytics_events.csv) : tout nouvel événement y est ajouté.

## Deux sources d'événements

| | Client (app / portail) | Serveur (Cloud Functions) |
|---|---|---|
| Envoi | `AnalyticsService` (app), `@/lib/posthog` (portail) | `captureClubEvent` / `captureAnonymousEvent` (`functions/src/analytics.ts`) |
| Consentement | Obligatoire (feuille app, bandeau cookies portail) | Non requis : aucune personne identifiée |
| Rattachement | uid Firebase + groupe `club` | Groupe `club` seulement (`distinct_id` = `club_<id>`), ou anonyme (`server_anonymous`) pour l'inscription |
| Propriété `surface` | `app` / `portal` | `server` |
| Fiabilité | Perdu si refus, bloqueur de pub, réseau coupé | Envoyé après l'écriture Firestore, rien ne se perd côté client |

Les événements importants (inscription, club créé, invitations, arrivées, événements, convocations, RSVP, paiement réussi) partent du serveur. Les mesures par club (clubs actifs, entonnoir d'activation, cotisations) reposent dessus. Les mesures par personne (utilisateurs actifs, rétention, plateformes) ne comptent que les personnes qui ont consenti.

Projet PostHog : la base `v2-prod` envoie au projet « ViroTeam prod », `v2-dev` au projet « ViroTeam dev ». Une app debug lancée avec `FORCE_PROD_BACKEND` écrit en prod, donc ses événements serveur arrivent dans le projet prod.

## Tableaux de bord (PostHog)

Le script [`tool/posthog_dashboards.mjs`](../tool/posthog_dashboards.mjs) crée les quatre tableaux ci-dessous. Il ne recrée pas un tableau qui existe déjà avec le même nom.

1. Dans PostHog › Paramètres personnels › Personal API keys, crée une clé avec les droits en écriture sur `dashboard`, `insight` et `action`, et en lecture sur `group`.
2. Lance d'abord le script sur le projet **dev**, après avoir déployé les Functions dev. Il faut qu'au moins un événement soit rattaché à un club, sinon le type de groupe `club` n'existe pas encore :

   ```bash
   POSTHOG_PERSONAL_API_KEY=phx_… POSTHOG_PROJECT_ID=<id dev> node tool/posthog_dashboards.mjs
   ```

3. Vérifie le rendu, puis relance-le avec l'id du projet **prod**. `--dry-run` affiche les requêtes sans rien créer.

| Tableau | Contenu |
|---|---|
| **Santé** | **Clubs actifs par semaine**, la métrique principale : clubs avec au moins 1 `event_created` et 3 `rsvp_set` dans la semaine. Aussi : utilisateurs actifs, clubs avec de l'activité, nouveaux clubs et inscriptions, répartition app iOS / app Android / portail |
| **Activation des clubs** | Entonnoir par club sur 30 jours : `club_created` → `invitation_sent` → arrivée d'un membre avec `member_count ≥ 5` (action « Membre arrivé dans un club ») → `event_created` → `rsvp_set` |
| **Rétention** | Cohortes hebdomadaires (première identification) et part des personnes qui reviennent sur 8 semaines |
| **Cotisations** | Entonnoir `fee_payment_started` → `fee_payment_submitted` → `fee_payment_succeeded` par club, et montant encaissé par semaine |

Les requêtes SQL (clubs actifs, plateformes) s'affichent en tableau. Pour les voir en courbe : dans l'insight, Visualisation › Line chart.

### Stripe dans PostHog (optionnel)

PostHog › Data pipeline › Sources › Stripe, avec une clé Stripe **restreinte en lecture seule**. Tu peux ensuite croiser les paiements Stripe (frais, remboursements) avec `fee_payment_succeeded` en SQL. Ce n'est pas nécessaire pour l'entonnoir, qui fonctionne déjà avec les événements serveur.

### Alertes

À régler à la main dans PostHog : insight › bouton **Alerts** › New alert. L'API des alertes est encore instable, donc le script ne les crée pas.

| Insight | Condition | Fréquence |
|---|---|---|
| Clubs actifs par semaine | Baisse relative de plus de 30 % par rapport à la semaine précédente | Hebdo (lundi) |
| Nouveaux clubs et inscriptions (série `signup_completed`) | Valeur absolue égale à 0 sur la semaine | Hebdo |
| Montant encaissé par semaine | Baisse relative de plus de 50 % (en période de cotisations) | Hebdo |

Les alertes arrivent par e-mail. Garde-les peu nombreuses : une alerte qui sonne pour rien finit ignorée.

## Stores et acquisition

### Appfigures

1. Crée un compte sur appfigures.com. L'offre gratuite suffit pour une app.
2. Connecte la **Play Console** : invite le compte de service ou l'e-mail fourni par Appfigures avec les droits « Afficher les informations sur l'application » et « Afficher les données financières ».
3. Connecte **App Store Connect** : une clé API App Store Connect avec le rôle *Sales and Reports*.
4. Dans Account › Reports, active le **résumé hebdo par e-mail** : installations, notes et avis des deux stores sur un seul écran.

### Liens « Télécharger l'app » marqués

Chaque lien vers un store indique sa source (`utm_source`, la surface) et son emplacement (`utm_campaign`) :

| Où | Source | Campagne | Play Console (`referrer`) | App Store (`ct`) |
|---|---|---|---|---|
| Badges stores du site / portail (`StoreBadges`) | `portal` | `store_badges` | `utm_source=portal&utm_campaign=store_badges` | `portal_store_badges` |
| Messages d'invitation copiés depuis le portail | `portal` | `invite_share` | idem | `portal_invite_share` |
| Messages d'invitation partagés depuis l'app | `app` | `invite_share` | idem | `app_invite_share` |
| E-mails d'invitation (Functions, Brevo) | `email` | `invite` | idem | `email_invite` |

Où lire les résultats :

- **Google Play** : Play Console › Statistiques › Acquisition des utilisateurs › Campagnes UTM.
- **App Store** : Apple n'attribue la campagne `ct` qu'avec le jeton fournisseur `pt`. Récupère-le dans App Store Connect › App Analytics › Acquisition › Campaigns › *Generate Campaign Link*, puis renseigne-le à trois endroits :
  - `APP_STORE_PROVIDER_TOKEN` dans `portal/src/lib/storeLinks.ts`
  - `ProjectConfig.appStoreProviderToken` dans `lib/config/project_config.dart`
  - le paramètre Functions `APP_STORE_URL`, en ajoutant `?pt=<jeton>`

  Le résultat apparaît dans App Analytics › Sources › Campaigns.

### Enregistrement des sessions (portail)

Pas activé pour l'instant (décision 2026-10). Pour l'activer plus tard : uniquement après consentement, avec tous les champs de saisie masqués, en mettant à jour la page Confidentialité, et en l'activant dans les réglages du projet PostHog.

## Le rituel du lundi (15 min)

1. Ouvre le tableau **Santé** : clubs actifs, nouveaux clubs, utilisateurs actifs. Note la tendance (en hausse, stable ou en baisse) et la raison si tu la connais.
2. Ouvre **Activation des clubs** : repère l'étape où les clubs décrochent le plus cette semaine.
3. Écris **une seule question** de la semaine dans le tableau ci-dessous (par exemple : « Pourquoi 40 % des clubs créés n'envoient aucune invitation ? »).
4. Ajoute un événement **seulement** s'il répond à cette question : mets à jour `analytics_events.csv`, puis instrumente.

| Semaine | Clubs actifs | Constat | Question de la semaine |
|---|---|---|---|
| | | | |
