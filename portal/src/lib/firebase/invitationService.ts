import {
  collectionGroup,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import { getClub } from "./clubService";
import { Collections, Fields, InvitationStatus } from "./constants";

export type InvitationLookupResult = {
  invitationId: string;
  clubId: string;
  code: string;
  role: string;
  clubName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

/** Recherche une invitation active par code (aligné InvitationService Flutter). */
export async function findInvitationByCode(
  rawCode: string,
): Promise<InvitationLookupResult | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  const snap = await getDocs(
    query(
      collectionGroup(getAppFirestore(), Collections.invitations),
      where(Fields.code, "==", code),
      where(Fields.status, "==", InvitationStatus.pending),
      limit(1),
    ),
  );

  if (snap.empty) return null;

  const inviteDoc = snap.docs[0];
  const data = inviteDoc.data() as Record<string, unknown>;
  const clubId = inviteDoc.ref.parent.parent?.id ?? "";
  if (!clubId) return null;

  let clubName = String(data[Fields.clubName] ?? "").trim();
  if (!clubName) {
    const club = await getClub(clubId);
    clubName = club?.name ?? "";
  }
  if (!clubName) return null;

  return {
    invitationId: inviteDoc.id,
    clubId,
    code,
    role: String(data[Fields.role] ?? ""),
    clubName,
    firstName: String(data[Fields.firstName] ?? "").trim() || undefined,
    lastName: String(data[Fields.lastName] ?? "").trim() || undefined,
    email: String(data[Fields.email] ?? "").trim() || undefined,
  };
}
