import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  memoryLruGarbageCollector,
  terminate,
} from "firebase/firestore";

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

let appFirestore: Firestore | null = null;

/**
 * Instance Firestore sur v2-dev / v2-prod.
 * Ne jamais utiliser getFirestore(app) sans databaseId.
 *
 * Cache mémoire LRU (pas de persistance disque : rien ne reste sur un poste
 * partagé après déconnexion) : les documents survivent à la fermeture d’un
 * listener, donc un panneau rouvert ne retélécharge que les changements.
 */
export function getAppFirestore(): Firestore {
  if (appFirestore) return appFirestore;
  const app = getFirebaseApp();
  const databaseId = getFirestoreDatabaseId();
  try {
    appFirestore = initializeFirestore(
      app,
      {
        localCache: memoryLocalCache({
          garbageCollector: memoryLruGarbageCollector(),
        }),
      },
      databaseId,
    );
  } catch {
    // Déjà initialisée (HMR dev) : on réutilise l’instance existante.
    appFirestore = getFirestore(app, databaseId);
  }
  return appFirestore;
}

/**
 * Ferme l’instance Firestore et vide son cache mémoire (déconnexion) :
 * le compte suivant ne voit jamais les documents du précédent.
 */
export async function resetAppFirestore(): Promise<void> {
  const current = appFirestore;
  if (!current) return;
  appFirestore = null;
  await terminate(current).catch(() => undefined);
}
