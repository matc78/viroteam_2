import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import {
  ServerAnalyticsEvents,
  captureAnonymousEvent,
  captureClubEvent,
} from "./analytics";
import { runWithDatabase, type FirestoreDatabaseId } from "./db";

const REGION = "europe-west1";

/**
 * `club_created` à la création du document club (app, portail ou seed) :
 * point d'entrée serveur de l'entonnoir d'activation, indépendant du
 * consentement analytics de l'admin.
 */
function defineClubCreatedTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentCreated(
    {
      document: "clubs/{clubId}",
      database: databaseId,
      region: REGION,
    },
    (event) =>
      runWithDatabase(databaseId, () =>
        captureClubEvent({
          clubId: event.params.clubId,
          event: ServerAnalyticsEvents.clubCreated,
          properties: {
            sport: String(event.data?.data()?.sport ?? "").trim() || "unknown",
          },
        }),
      ),
  );
}

/**
 * Mode d'inscription (`password`, `google.com`, `apple.com`…) sans PII ;
 * `unknown` si le compte Auth est introuvable.
 */
async function signupMethod(uid: string): Promise<string> {
  try {
    const user = await admin.auth().getUser(uid);
    return user.providerData[0]?.providerId ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * `signup_completed` à la création du profil `users/{uid}` : compteur
 * anonyme (aucun uid envoyé), fiable même avant le consentement demandé
 * dans l'app après l'inscription.
 */
function defineUserCreatedTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentCreated(
    {
      document: "users/{uid}",
      database: databaseId,
      region: REGION,
    },
    (event) =>
      runWithDatabase(databaseId, async () =>
        captureAnonymousEvent({
          event: ServerAnalyticsEvents.signupCompleted,
          properties: { method: await signupMethod(event.params.uid) },
        }),
      ),
  );
}

export const onClubCreatedForAnalytics = defineClubCreatedTrigger("v2-prod");
export const onClubCreatedForAnalyticsDev = defineClubCreatedTrigger("v2-dev");
export const onUserCreatedForAnalytics = defineUserCreatedTrigger("v2-prod");
export const onUserCreatedForAnalyticsDev = defineUserCreatedTrigger("v2-dev");
