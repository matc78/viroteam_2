import * as admin from "firebase-admin";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { userProfileFieldsChanged } from "./chat/memberChatDiff";
import { db, runWithDatabase, type FirestoreDatabaseId } from "./db";
import { memberProfileSyncPatch } from "./memberProfileSyncUtils";
import { declaredClubIds } from "./userClubIdsUtils";

const REGION = "europe-west1";

/**
 * Fiche membre du compte [uid] dans [clubId] : `members/{uid}` (une seule clé
 * membre), ou null si le compte n'a pas de fiche dans ce club.
 */
async function accountMemberSnap(
  clubId: string,
  uid: string,
): Promise<DocumentSnapshot | null> {
  const own = await db()
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(uid)
    .get();
  return own.exists ? own : null;
}

/**
 * Profil `users/{uid}` modifié (nom, photo) : recopie sur la fiche membre du
 * compte dans chacun de ses clubs. Seul écrivain de cette synchro (app,
 * portail, anciennes versions). N'écrit jamais `users`, donc pas de boucle ;
 * `onMemberWrittenForChat` met ensuite les conversations à jour.
 */
function defineMemberProfileSyncTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentWritten(
    {
      document: "users/{uid}",
      database: databaseId,
      region: REGION,
    },
    (event) =>
      runWithDatabase(databaseId, async () => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!after || !userProfileFieldsChanged(before, after)) return;
        const uid = event.params.uid;
        for (const clubId of declaredClubIds(after.clubMemberships)) {
          try {
            const member = await accountMemberSnap(clubId, uid);
            if (!member) continue;
            const patch = memberProfileSyncPatch(after, member.data() ?? {});
            if (!patch) continue;
            await member.ref.update({
              ...patch,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } catch (error) {
            console.error("memberProfileSync failed", { clubId, uid, error });
          }
        }
      }),
  );
}

export const onUserWrittenSyncMemberProfile =
  defineMemberProfileSyncTrigger("v2-prod");
export const onUserWrittenSyncMemberProfileDev =
  defineMemberProfileSyncTrigger("v2-dev");
