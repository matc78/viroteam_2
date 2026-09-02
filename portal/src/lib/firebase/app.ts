import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const MISSING_DATABASE_ID_MESSAGE =
  "NEXT_PUBLIC_FIRESTORE_DATABASE_ID manquant : définis `v2-dev` (local, portal/.env.local) ou `v2-prod` (apphosting.yaml). Aucun fallback n’est appliqué pour éviter d’écrire dans la mauvaise base.";

/**
 * ID de base Firestore — jamais la base default (miroir appFirestore Flutter).
 * Lève une erreur explicite si la variable d’environnement est absente :
 * pas de fallback silencieux vers `v2-dev`.
 */
export function getFirestoreDatabaseId(): string {
  const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim();
  if (!databaseId) {
    throw new Error(MISSING_DATABASE_ID_MESSAGE);
  }
  return databaseId;
}

function assertConfig(): void {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error(
      "Config Firebase manquante. Copie portal/.env.local.example vers portal/.env.local.",
    );
  }
  // Lève si NEXT_PUBLIC_FIRESTORE_DATABASE_ID est absent.
  getFirestoreDatabaseId();
}

/** Initialise (ou réutilise) l’app Firebase web. */
export function getFirebaseApp(): FirebaseApp {
  assertConfig();
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

/** Auth Firebase du portail. */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/**
 * Instance Firestore sur v2-dev / v2-prod.
 * Ne jamais utiliser getFirestore(app) sans databaseId.
 */
export function getAppFirestore(): Firestore {
  return getFirestore(getFirebaseApp(), getFirestoreDatabaseId());
}
