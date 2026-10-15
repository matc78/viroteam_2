# Déploiement iOS — checklist

Guide pour publier ViroTeam sur TestFlight puis l’App Store.  
Complète le travail automatisé déjà en place dans le repo (`Info.plist`, `PrivacyInfo.xcprivacy`, suppression de compte, liens légaux).

**Prérequis** : compte [Apple Developer](https://developer.apple.com) (99 €/an).  
**Build** : GitHub Actions (recommandé, voir ci-dessous), Mac + Xcode, ou Codemagic (ancienne piste, ses builds sont marquées « TestFlight interne seulement » et ne peuvent pas partir en vente).

---

## GitHub Actions (tag → TestFlight) — recommandé

Workflow [`.github/workflows/release-ios.yml`](../.github/workflows/release-ios.yml) : sur un tag `v*` ou `release-v*` (ou à la demande dans l'onglet Actions), un runner macOS construit l'IPA, le signe avec la clé API App Store Connect (signature « cloud », aucun certificat ni profil à exporter) et l'envoie sur App Store Connect. La build apparaît dans TestFlight une fois traitée par Apple.

### Une fois — secrets du dépôt

**OK** — `ASC_KEY_ID`, `ASC_ISSUER_ID` et `ASC_API_KEY_P8` sont renseignés dans Settings → Secrets and variables → Actions.

| Secret | Valeur |
|--------|--------|
| `ASC_KEY_ID` | ID de la clé API (ex. `29DPBG3FGV`) |
| `ASC_ISSUER_ID` | Issuer ID (UUID affiché en haut de la page Intégrations → App Store Connect API) |
| `ASC_API_KEY_P8` | Contenu complet du fichier `AuthKey_<KEY_ID>.p8`, lignes `BEGIN`/`END` comprises |

La clé doit avoir le rôle **App Manager** ou **Admin**. Le Team ID (`7W9T8GP8NG`) et le bundle (`com.viroteam.viroTeam`) sont dans le workflow.

### À chaque release

1. `main` vert, version alignée (`node tool/check_app_version.mjs --tag=v2.2.4`).
2. `git tag v2.2.4 && git push origin v2.2.4` — déclenche Release Android **et** Release iOS.
3. Actions → **Release iOS** → attendre le vert ; l'IPA et les logs sont en artefacts du run.
4. App Store Connect → TestFlight : la build est traitée en 10 à 20 min, puis sélectionnable dans la version.

Build number = `100 + numéro du run` (toujours croissant, jamais en conflit avec les builds envoyés à la main). Version = `pubspec.yaml`.

### Si la signature cloud échoue

Message du type « No signing certificate » ou « Provisioning profile … doesn't include » dans `xcodebuild-archive.log` : vérifier le rôle de la clé API, puis que l'App ID `com.viroteam.viroTeam` a bien les capacités Push Notifications et Sign in with Apple (Certificates, IDs & Profiles → Identifiers). En dernier recours, passer en signature manuelle : exporter un certificat Apple Distribution en `.p12` et un profil App Store depuis un Mac, les mettre en secrets, et remplacer l'étape Archive par un import dans le trousseau du runner.

---

## Codemagic (Windows → TestFlight)

Parcours pour publier sans Mac local. Les builds TestFlight existants (pote / Mac) restent valides ; Codemagic envoie les suivants.

### A. Une fois — Apple + Codemagic UI

1. **App Store Connect API key** (si pas déjà faite)  
   Users and Access → Integrations → App Store Connect API → générer (rôle *App Manager*).  
   Noter Issuer ID, Key ID, télécharger le `.p8` **une seule fois**.  
   Ne jamais committer le `.p8` (déjà dans `.gitignore`).

2. Compte [Codemagic](https://codemagic.io) → **Add application** → lier le repo GitHub → type Flutter.

3. **Team settings → Team integrations → Developer Portal → Manage keys**  
   - Nom de la clé : `ViroTeam` (doit matcher `integrations.app_store_connect` dans `codemagic.yaml`)  
   - Issuer ID + Key ID + upload du `.p8`

4. **Code signing identities** (team settings)  
   - iOS certificates → **Generate certificate** → *Apple Distribution* (avec la clé `ViroTeam`)  
     *ou* Fetch si un cert Codemagic existe déjà  
   - iOS provisioning profiles → **Fetch profiles** → profil **App Store** pour `com.viroteam.viroTeam`

5. **Application → Environment variables** → groupe `ios_secrets` :  
   | Variable | Valeur |
   |----------|--------|
   | `APP_STORE_APPLE_ID` | App Store Connect → Général → Infos sur l’app → **Apple ID** (nombre) |
   | `GOOGLE_SERVICE_INFO_PLIST` | Contenu de `ios/Runner/GoogleService-Info.plist` encodé en **base64** (secret) |

   Sous Windows (PowerShell), depuis la racine du repo si le plist est en local :

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("ios\Runner\GoogleService-Info.plist"))
   ```

6. Dans Codemagic → app → **Check for configuration file** sur la branche qui contient `codemagic.yaml`.

### B. À chaque release bêta

1. Pousser la branche (ou tag) avec le code à publier.  
2. Codemagic → workflow **iOS TestFlight** → Start build.  
3. Attendre le build vert → le `.ipa` part sur App Store Connect.  
4. Onglet **TestFlight** → build « Terminé » → disponible pour le groupe **Interne**.

Le workflow incrémente automatiquement le **build number** (plus haut que le dernier TestFlight). Le **version name** vient de `pubspec.yaml` (ex. `2.2.2`).

### C. App Store (prod) — après TestFlight OK

Le workflow **n’envoie pas** en review App Store (`submit_to_app_store: false`).  
Dans App Store Connect → Distribution :

- Créer / finaliser une version dont le numéro = `pubspec` (ex. `2.2.2`, pas rester bloqué sur une fiche `1.0` vide)
- Captures d’écran (obligatoires pour la review publique ; pas pour TestFlight interne)
- « Ajouter pour vérification » une fois le build TestFlight sélectionné

---

## 1. Décision bundle ID

| Option | Bundle | Conséquence |
|--------|--------|-------------|
| **A — Nouvelle app** (recommandé pour v2) | `com.viroteam.viroTeamV2` (déjà dans Xcode) | Nouvelle fiche App Store ; Firebase iOS à (re)créer / lier à ce bundle |
| **B — Remplacer la beta** | `com.viroteam.viroTeam` (dans `lib/firebase_options.dart` aujourd’hui) | Même app Firebase legacy ; aligner `PRODUCT_BUNDLE_IDENTIFIER` dans Xcode |

Tant que les deux ne sont pas alignés, Auth / Crashlytics / Google Sign-In iOS échoueront.

Choix figé → une seule valeur partout : Xcode, Firebase Console, `firebase_options.dart`, `GoogleService-Info.plist`.

---

## 2. Prérequis une fois

- [ ] Compte Apple Developer actif (Team ID noté)
- [ ] App créée dans [App Store Connect](https://appstoreconnect.apple.com) (nom ViroTeam, bundle choisi)
- [ ] Mac avec Xcode + signing automatique (Team sélectionnée sur la target Runner)
- [ ] Certificates / Provisioning Profiles (Xcode gère en Automatic)

---

## 3. Firebase iOS

`GoogleService-Info.plist` est **gitignoré** (voir `.gitignore`). À placer en local uniquement.

```bash
# Depuis la racine du repo
flutterfire configure --project=viroteam-75303
# Cocher l’app iOS avec le bon bundle ID
```

- [ ] Copier `ios/Runner/GoogleService-Info.plist` (généré / téléchargé)
- [ ] Vérifier que `lib/firebase_options.dart` a le même `iosBundleId` que Xcode
- [ ] Rebuild : `fvm flutter clean && fvm flutter pub get`

---

## 4. Google Sign-In (Info.plist)

Après obtention du plist, ouvrir `GoogleService-Info.plist` et noter :

- `CLIENT_ID` → clé `GIDClientID` dans `Info.plist`
- `REVERSED_CLIENT_ID` → schéma URL supplémentaire dans `CFBundleURLSchemes`

Exemple (valeurs **à remplacer** par celles du plist) :

```xml
<key>GIDClientID</key>
<string>XXXX.apps.googleusercontent.com</string>
```

Dans `CFBundleURLTypes`, ajouter un schéma :

```xml
<string>com.googleusercontent.apps.XXXX</string>
```

Le schéma `viroteam` (deep link join) est déjà présent.

Dans la [console Google Cloud](https://console.cloud.google.com/) / Firebase Auth → Google : autoriser le bundle iOS.

---

## 5. Permissions déjà préparées dans le repo

| Clé | Rôle |
|-----|------|
| `NSPhotoLibraryUsageDescription` | Logo club (`ImagePicker`) |
| `NSCalendars*` | Sync calendrier |
| `ITSAppUsesNonExemptEncryption` = false | Export compliance HTTPS only |
| `PrivacyInfo.xcprivacy` | Privacy Manifest (à valider au 1er upload) |

À vérifier au premier build si Apple signale d’autres API déclarées manquantes.

---

## 6. Associated Domains (optionnel mais recommandé)

Pour ouvrir `https://www.viroteam.com/join?code=…` dans l’app :

1. Xcode → Runner → Signing & Capabilities → **Associated Domains**  
   `applinks:www.viroteam.com`
2. Héberger `apple-app-site-association` sur le domaine (App Hosting / Hosting) avec `appID` = `TEAMID.com.viroteam.…`

Le deep link custom `viroteam://join` fonctionne déjà sans Associated Domains.

---

## 7. Build local

```bash
fvm flutter build ipa --release
# ou ouvrir ios/Runner.xcworkspace dans Xcode → Product → Archive
```

- [ ] Team ID renseigné
- [ ] Version / build number cohérents avec `pubspec.yaml` (ou surchargés en CI plus tard)
- [ ] Archive réussie sans warning bloquant Privacy Manifest

---

## 8. TestFlight

- [ ] Upload via Xcode Organizer ou `xcrun altool` / Transporter
- [ ] Export compliance : « Uses encryption » → No (ou équivalent grâce à `ITSAppUsesNonExemptEncryption`)
- [ ] Privacy Nutrition Labels (App Store Connect) alignés sur la [politique de confidentialité](https://www.viroteam.com/legal/privacy)
- [ ] Ajouter testeurs internes, puis externes si besoin
- [ ] Tester : Auth email, Google Sign-In, join code, logo club (photos), calendrier, suppression de compte

---

## 9. App Store (review)

Guideline **5.1.1** : suppression de compte **in-app** (déjà dans Profil mobile + Settings portail).

À fournir dans la fiche :

- [ ] URL confidentialité : `https://www.viroteam.com/legal/privacy`
- [ ] URL support / CGU : `https://www.viroteam.com/legal/cgu`
- [ ] Captures d’écran iPhone (et iPad si supporté)
- [ ] Texte description + mots-clés
- [ ] Review notes (compte démo invitation-only, code d’invitation de test)
- [ ] Âge / données mineurs (espace parent) — cohérent avec la privacy

---

## 10. Après publication

- [ ] Mettre `appStoreUrl` dans [`portal/src/lib/site.ts`](../portal/src/lib/site.ts)
- [ ] Retirer le badge « Bientôt » dans [`portal/src/components/StoreBadges.tsx`](../portal/src/components/StoreBadges.tsx) et copy landing
- [ ] Tag `portal-v*` pour déployer le portail mis à jour
- [ ] CI iOS : [`codemagic.yaml`](../codemagic.yaml) (TestFlight) — setup UI § Codemagic

---

## Références

- Suite manuelle globale : [`DEPLOY_SUITE.md`](DEPLOY_SUITE.md)
- Setup local : [`SETUP_LOCAL.md`](../SETUP_LOCAL.md)
- Roadmap : [`ROADMAP.md`](ROADMAP.md)
