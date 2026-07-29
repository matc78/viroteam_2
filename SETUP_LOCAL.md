# Fichiers locaux à copier (non versionnés)

Ces fichiers restent hors git. Copie-les depuis l’ancien repo `viro_team` (beta) vers ce repo.

## Android — signatures

| Source (beta `viro_team`) | Destination (`viroteam_2`) |
|---|---|
| `android/key.properties` | `android/key.properties` |
| `android/app/debug.keystore` | `android/app/debug.keystore` |
| le keystore release référencé dans `key.properties` (`storeFile`) | même chemin relatif sous `android/` |

Sans ces fichiers : builds debug/release Android non signés comme en beta.

Pour le quotidien (`flutter run`), le keystore release n’est pas obligatoire. Il sert surtout aux builds **release / Play Store**.

## CI — secrets GitHub (recommandé)

Une fois les fichiers récupérés, dépose-les aussi en **secrets du repo** GitHub pour ne plus avoir à les copier-coller à chaque machine / clone. Ils restent hors git ; la CI les reconstruit sur le runner avant le build.

**Settings → Secrets and variables → Actions** sur ce repo :

| Secret GitHub | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | keystore release encodé en base64 |
| `ANDROID_KEY_PROPERTIES` | contenu brut de `android/key.properties` |
| `ANDROID_DEBUG_KEYSTORE_BASE64` | (optionnel) `android/app/debug.keystore` en base64 |

Encoder un fichier (PowerShell) :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android\app\upload-keystore.jks")) | Set-Clipboard
```

Puis coller la valeur dans le secret GitHub.

Dans un workflow GitHub Actions (à ajouter plus tard), restaurer ainsi avant `flutter build appbundle` :

```yaml
- name: Restore Android signing
  run: |
    echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 --decode > android/app/upload-keystore.jks
    echo "${{ secrets.ANDROID_KEY_PROPERTIES }}" > android/key.properties
    # optionnel :
    # echo "${{ secrets.ANDROID_DEBUG_KEYSTORE_BASE64 }}" | base64 --decode > android/app/debug.keystore
```

Adapter le chemin du keystore dans `key.properties` (`storeFile`) pour qu’il corresponde au fichier écrit par la CI.

## Android — Firebase

`android/app/google-services.json` est déjà présent dans ce repo (app `com.viroteam.viro_team_v2`).

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

## Vérification rapide

```bash
flutter pub get
flutter run
```

Bases Firestore utilisées : `v2-dev` (debug) / `v2-prod` (release) — projet `viroteam-75303`.
