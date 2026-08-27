# Fichiers locaux à copier (non versionnés)

Ces fichiers restent hors git. Copie-les depuis l’ancien repo `viro_team` (beta) vers ce repo.

## Android / iOS — icône & splash

Les assets sources sont dans `assets/branding/` (versionnés). Régénérer après modification :

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

- Icône : `app_icon.png` + `app_icon_foreground.png` (adaptive Android)
- Splash : `splash.png` (fond blanc + formes colorées + logo) ; Android 12+ utilise `splash_logo.png`

## Android — signatures

| Source (beta `viro_team`) | Destination (`viroteam_2`) |
|---|---|
| `android/key.properties` | `android/key.properties` |
| `android/app/debug.keystore` | `android/app/debug.keystore` |
| le keystore release référencé dans `key.properties` (`storeFile`) | même chemin relatif sous `android/` |

Sans ces fichiers : builds debug/release Android non signés comme en beta.

Pour le quotidien (`flutter run`), le keystore release n’est pas obligatoire. Il sert surtout aux builds **release / Play Store**.

## CI — secrets GitHub

Une fois les fichiers récupérés, dépose-les en **secrets du repo** GitHub. Ils restent hors git ; le workflow [`.github/workflows/release-android.yml`](.github/workflows/release-android.yml) les reconstruit sur le runner avant le build APK/AAB.

Les secrets ci-dessous sont **obligatoires** pour les releases / deploys. Ils ne sont **pas** requis pour la CI qualité (`.github/workflows/ci.yml`).

**Settings → Secrets and variables → Actions** sur ce repo :

| Secret GitHub | Contenu | Obligatoire |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | keystore release encodé en base64 | oui (Release Android) |
| `ANDROID_KEY_PROPERTIES` | contenu de `key.properties` avec chemin **relatif CI** | oui (Release Android) |
| `ANDROID_DEBUG_KEYSTORE_BASE64` | `android/app/debug.keystore` en base64 | non |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | JSON compte de service Play Console (upload AAB) | oui (tags `v*` / `release-v*`) |
| `FIREBASE_SERVICE_ACCOUNT_PORTAL` | JSON SA GCP — rollouts App Hosting | oui (tag `portal-v*`) |
| `FIREBASE_SERVICE_ACCOUNT_DEPLOY` | JSON SA GCP — Functions + Firestore (peut être le même JSON que le SA portal si rôles suffisants : Functions Admin, Cloud Datastore Owner / Firebase Rules) | oui (tags `functions-*` / `firestore-*`) |

### Environments GitHub (recommandé)

Créer sous **Settings → Environments** :

| Environment | Workflows | Protection |
|---|---|---|
| `play-store` | Release Android → upload Play | reviewers optionnels |
| `firebase-dev` | Deploy functions / firestore (cible dev) | — |
| `firebase-prod` | Deploy portal + functions / firestore (cible prod) | reviewers recommandés |

### Contenu de `ANDROID_KEY_PROPERTIES`

Le secret doit utiliser un `storeFile` **relatif** à `android/` (pas un chemin Windows absolu). Le workflow écrit le keystore dans `android/app/upload-keystore.jks` :

```properties
storePassword=***
keyPassword=***
keyAlias=upload
storeFile=app/upload-keystore.jks
```

En local, tu peux garder un chemin absolu dans ton `android/key.properties` (hors git) ; seul le secret GitHub doit utiliser le chemin relatif ci-dessus.

### Encoder le keystore (PowerShell)

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\upload-keystore.jks")) | Set-Clipboard
```

Puis coller la valeur dans le secret `ANDROID_KEYSTORE_BASE64`.

### Restauration côté CI

Le workflow release restaure ainsi avant `flutter build apk --release` :

```yaml
- name: Restore Android signing
  env:
    ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
    ANDROID_KEY_PROPERTIES: ${{ secrets.ANDROID_KEY_PROPERTIES }}
  run: |
    echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > android/app/upload-keystore.jks
    printf '%s\n' "$ANDROID_KEY_PROPERTIES" > android/key.properties
```

### Publier Android (tags)

```bash
# Track Play internal + GitHub Release (APK + AAB)
git tag v1.0.0
git push origin v1.0.0

# Track Play production (pas de GitHub Release)
git tag release-v1.0.0
git push origin release-v1.0.0
```

Build manuel (sans tag) : **Actions → Release Android → Run workflow** (artifacts seuls, pas Play ni GitHub Release).
## Android — Firebase

`android/app/google-services.json` est déjà présent dans ce repo (app Android `com.viroteam.viro_team`, même package que la v1 Play Store).

Si tu régénères la config :

```bash
flutterfire configure --project=viroteam-75303
```

## iOS / macOS

| Source (beta) | Destination |
|---|---|
| `ios/Runner/GoogleService-Info.plist` (si tu l’as en local) | `ios/Runner/GoogleService-Info.plist` |
| idem macOS si besoin | `macos/Runner/GoogleService-Info.plist` |

Note : `lib/firebase_options.dart` pointe encore le bundle iOS `com.viroteam.viroTeam` (app Firebase beta). Le bundle Xcode local est `com.viroteam.viroTeamV2`. À aligner plus tard avec `flutterfire configure` si Auth / Crashlytics iOS posent problème.

## Portail web (Next.js)

Le portail utilise des variables d'environnement non versionnées.

```bash
cd portal
cp .env.local.example .env.local
```

Remplir ensuite les valeurs dans `portal/.env.local` :

| Variable | Rôle | Obligatoire |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Config Firebase web (déjà préremplie dans l'example) | oui |
| `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` | `v2-dev` (local) ou `v2-prod` (prod) | oui |
| `NEXT_PUBLIC_DEV_AUTH_BYPASS` | `true` pour connexion sans limite en dev local | recommandé |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Email du compte de service Admin SDK | oui si bypass activé |
| `FIREBASE_ADMIN_KEY_PATH` | Chemin vers le JSON de clé privée Admin SDK | oui si bypass activé |
| `NEXT_PUBLIC_POSTHOG_KEY` | Clé projet PostHog (analytics) | non |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN Sentry (monitoring erreurs) | non |

Pour le bypass auth en dev, télécharger la clé privée du compte de service : Console Firebase → Paramètres → Comptes de service → **Générer une nouvelle clé privée**, puis placer le JSON dans `portal/` et renseigner `FIREBASE_ADMIN_KEY_PATH`.

Le fichier `portal/.env.sentry-build-plugin` est créé automatiquement par `npx @sentry/wizard` si tu configures Sentry. Il contient le `SENTRY_AUTH_TOKEN` et ne doit **jamais** être commité.

## Cloud Functions (invitations e-mail Brevo)

```bash
firebase functions:secrets:set BREVO_API_KEY
# coller la clé API Brevo (viroteam-functions-dev)

cd functions
# params locaux (déjà dans .env.viroteam-75303 si présent) :
# BREVO_SENDER_EMAIL=noreply@viroteam.com
# BREVO_SENDER_NAME=ViroTeam
# INVITE_JOIN_BASE_URL=https://www.viroteam.com

npm run build
# prod → v2-prod ; Dev → v2-dev (portail / app choisissent selon la base)
firebase deploy --only functions:sendMemberInvites,functions:sendMemberInvitesDev
```

Voir aussi [`functions/README.md`](functions/README.md).

## Vérification rapide

```bash
flutter pub get
flutter run
```

Bases Firestore utilisées : `v2-dev` (debug) / `v2-prod` (release) — projet `viroteam-75303`.
