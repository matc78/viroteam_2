import { HttpsError } from "firebase-functions/v2/https";
import { db } from "./db";
import { generateUniqueInviteCode } from "./inviteCodeUtils";

/**
 * True si une invitation `pending` (tous clubs, tous types) porte déjà [code].
 * Même requête que `lookupInvitationByCode` (index `invitations` code+status).
 */
async function pendingInviteCodeTaken(code: string): Promise<boolean> {
  const snap = await db()
    .collectionGroup("invitations")
    .where("code", "==", code)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Code d'invitation cryptographiquement aléatoire et unique parmi les
 * invitations `pending`. À appeler juste avant d'écrire l'invitation.
 */
export async function newUniqueInviteCode(): Promise<string> {
  try {
    return await generateUniqueInviteCode({ isTaken: pendingInviteCodeTaken });
  } catch (error) {
    console.error("newUniqueInviteCode failed", error);
    throw new HttpsError(
      "unavailable",
      "Impossible de générer un code d'invitation — réessaie",
    );
  }
}
