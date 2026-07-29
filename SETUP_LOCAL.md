# Fichiers locaux à copier (non versionnés)

Ces fichiers restent hors git. Copie-les depuis l’ancien repo `viro_team` (beta) vers ce repo.

## Android — signatures

| Source (beta `viro_team`) | Destination (`viroteam_2`) |
|---|---|
| `android/key.properties` | `android/key.properties` |
| `android/app/debug.keystore` | `android/app/debug.keystore` |
| le keystore release référencé dans `key.properties` (`storeFile`) | même chemin relatif sous `android/` |

Sans ces fichiers : builds debug/release Android non signés comme en beta.

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
