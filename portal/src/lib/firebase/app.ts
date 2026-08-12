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

/** ID de base Firestore — jamais la base default (miroir appFirestore Flutter). */
export function getFirestoreDatabaseId(): string {
  return process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || "v2-dev";
}

function assertConfig(): void {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error(
      "Config Firebase manquante. Copie portal/.env.local.example vers portal/.env.local.",
    );
  }
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
