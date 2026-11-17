import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, runWithDatabase, type FirestoreDatabaseId } from "./db";
import {
  REKEY_FAILURE_COUNT_FIELD,
  REKEY_FEE_CONFLICT_FIELD,
  rewriteMemberReferencesWithRetry,
} from "./memberRekey";
import { shouldResumeRekey } from "./memberRekeyPlan";

const REGION = "europe-west1";
/** Fiches reprises au plus par passage (chaque reprise scanne les events du club). */
const RESUME_BATCH_LIMIT = 50;

function timestampMillis(value: unknown): number | null {
  if (value && typeof value === "object" && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : null;
  }
  return null;
}

/**
 * Reprend les re-keyings dont la réécriture des références n'a pas abouti
 * (`members/{uid}.rekeyPendingFrom` encore posé après les relances inline de
 * `acceptInvitation` / `acceptTeamInvitation`). La réécriture est idempotente
 * (chaque étape interroge par l'ancien id). Les conflits de cotisation et les
 * fiches en échec répété sont laissés à `tool/rekey_linked_members.mjs`.
 */
export async function resumePendingMemberRekeys(): Promise<{ resumed: number; failed: number }> {
  const firestore = db();
  const snap = await firestore
    .collectionGroup("members")
    .where("rekeyPendingFrom", ">", "")
    .limit(RESUME_BATCH_LIMIT)
    .get();
  let resumed = 0;
  let failed = 0;
  const nowMs = Date.now();
  for (const doc of snap.docs) {
    const clubRef = doc.ref.parent.parent;
    // Uniquement les fiches club : clubs/{clubId}/members/{uid}.
    if (!clubRef || clubRef.parent.id !== "clubs") continue;
    const data = doc.data();
    const lastWriteMs =
      timestampMillis(data.rekeyFailedAt) ?? timestampMillis(data.updatedAt);
    if (
      !shouldResumeRekey({
        memberId: doc.id,
        pendingFrom: data.rekeyPendingFrom,
        failureCount: data[REKEY_FAILURE_COUNT_FIELD],
        feeConflictSeasonIds: data[REKEY_FEE_CONFLICT_FIELD],
        lastWriteMs,
        nowMs,
      })
    ) {
      continue;
    }
    const report = await rewriteMemberReferencesWithRetry({
      firestore,
      clubId: clubRef.id,
      from: String(data.rekeyPendingFrom).trim(),
      uid: doc.id,
      attempts: 1,
    });
    if (report) resumed += 1;
    else failed += 1;
  }
  if (resumed > 0 || failed > 0) {
    console.log("resumePendingMemberRekeys", { resumed, failed });
  }
  return { resumed, failed };
}

function defineRekeyResumeSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "every 30 minutes",
      timeZone: "Europe/Paris",
      region: REGION,
      timeoutSeconds: 540,
    },
    async () => {
      await runWithDatabase(databaseId, () => resumePendingMemberRekeys());
    },
  );
}

export const scheduleMemberRekeyResume = defineRekeyResumeSchedule("v2-prod");
export const scheduleMemberRekeyResumeDev = defineRekeyResumeSchedule("v2-dev");
