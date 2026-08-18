import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

setGlobalOptions({ region: "europe-west1" });

const firestoreDatabaseId = defineString("FIRESTORE_DATABASE_ID", {
  default: "v2-dev",
});

/** Instance Firestore v2-dev / v2-prod (jamais la base default). */
export function db(): FirebaseFirestore.Firestore {
  return getFirestore(admin.app(), firestoreDatabaseId.value());
}
