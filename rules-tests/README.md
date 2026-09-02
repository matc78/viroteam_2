# Tests des règles Firestore

Rejoue dans l'émulateur chaque faille corrigée par le lot 1 sécurité (septembre 2026)
et les parcours nominaux (membre, coach, admin, parent, invité) qui doivent continuer à passer.

## Lancer

```bash
cd rules-tests
npm install
npm test          # firebase emulators:exec --only firestore … 'node --test'
```

Prérequis : `firebase-tools` (global) et un **JDK 21 ou plus** dans le `PATH`
(`firebase-tools` ≥ 14 refuse Java 17). Avec Homebrew :

```bash
brew install openjdk@21
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
```

Le `projectId` passé à l'émulateur est fictif : aucun appel réseau vers Firebase.

## Ajouter un test

Un test = un scénario métier lisible : « un coach ne peut pas inviter un admin ».
Le jeu de données de `beforeEach` (club, admin, coach, joueur, fiche pré-créée,
parent, invitations) suffit à la plupart des cas ; l'enrichir plutôt que de créer
un second fixture.
