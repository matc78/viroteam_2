# Déploiement iOS — checklist

Guide pour publier ViroTeam sur TestFlight puis l’App Store.  
Complète le travail automatisé déjà en place dans le repo (`Info.plist`, `PrivacyInfo.xcprivacy`, suppression de compte, liens légaux).

**Prérequis Mac** : Xcode récent, Flutter via FVM (`fvm flutter`), compte [Apple Developer](https://developer.apple.com) (99 €/an).

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
- [ ] (Optionnel) Workflow CI iOS — nécessite certificats Apple en secrets GitHub

---

## Références

- Suite manuelle globale : [`DEPLOY_SUITE.md`](DEPLOY_SUITE.md)
- Setup local : [`SETUP_LOCAL.md`](../SETUP_LOCAL.md)
- Roadmap : [`ROADMAP.md`](ROADMAP.md)
