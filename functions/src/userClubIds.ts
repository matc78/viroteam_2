import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, runWithDatabase, type FirestoreDatabaseId } from "./db";
import { declaredClubIds, sameClubIds } from "./userClubIdsUtils";

const REGION = "europe-west1";

/**
 * Clubs dont le compte [uid] est réellement membre : parmi ceux déclarés dans
 * `clubMemberships`, ne garde que ceux où existe `member_accounts/{uid}`
 * (fiche liée) ou `members/{uid}` (fondateur, fiche à l'uid).
 */
export async function verifiedMemberClubIds(
  uid: string,
  clubMemberships: unknown,
): Promise<string[]> {
  const candidates = declaredClubIds(clubMemberships);
  const checks = await Promise.all(
    candidates.map(async (clubId) => {
      const clubRef = db().collection("clubs").doc(clubId);
      const [accountSnap, memberSnap] = await Promise.all([
        clubRef.collection("member_accounts").doc(uid).get(),
        clubRef.collection("members").doc(uid).get(),
      ]);
      return accountSnap.exists || memberSnap.exists ? clubId : null;
    }),
  );
  return checks.filter((clubId): clubId is string => clubId !== null);
}

/**
 * Recalcule `users/{uid}.memberClubIds` à chaque écriture du profil (clubs
 * rejoints, quittés, création de club). N'écrit que si la liste change, donc
 * sa propre écriture ne relance pas de mise à jour.
 */
function defineUserClubIdsTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentWritten(
    {
      document: "users/{uid}",
      database: databaseId,
      region: REGION,
    },
    (event) =>
      runWithDatabase(databaseId, async () => {
        const after = event.data?.after;
        if (!after?.exists) return;
        const data = after.data() ?? {};
        const next = await verifiedMemberClubIds(
          event.params.uid,
          data.clubMemberships,
        );
        if (sameClubIds(data.memberClubIds, next)) return;
        await after.ref.update({ memberClubIds: next });
      }),
  );
}

export const onUserWrittenSyncClubIds = defineUserClubIdsTrigger("v2-prod");
export const onUserWrittenSyncClubIdsDev = defineUserClubIdsTrigger("v2-dev");
