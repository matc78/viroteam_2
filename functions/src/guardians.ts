import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DocumentData } from "firebase-admin/firestore";
import { db } from "./db";

const MAX_ACTIVE_GUARDIANS_PER_MEMBER = 1;
const INVITE_TTL_DAYS = 7;
const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 6;

const GUARDIAN_STATUS_PENDING = "pending";
const GUARDIAN_STATUS_ACTIVE = "active";
const GUARDIAN_STATUS_REVOKED = "revoked";
const INVITATION_TYPE_GUARDIAN = "guardian";
const RELATION_PARENT = "parent";
const RSVP_VALUES = new Set(["yes", "maybe", "no"]);

type ParentLink = {
  clubId: string;
  memberId: string;
  relation: string;
  status: string;
};

type GuardianPermissions = {
  canView: boolean;
  canRsvp: boolean;
  canPay: boolean;
};

function requireUid(request: { auth?: { uid: string } }): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  return request.auth.uid;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${name} requis`);
  }
  return value.trim();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateInviteCode(): string {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_CODE_CHARS[bytes[index]! % INVITE_CODE_CHARS.length];
  }
  return code;
}

function clubRef(clubId: string) {
  return db().collection("clubs").doc(clubId);
}

function memberRef(clubId: string, memberId: string) {
  return clubRef(clubId).collection("members").doc(memberId);
}

function guardianRef(clubId: string, memberId: string, parentUid: string) {
  return memberRef(clubId, memberId).collection("guardians").doc(parentUid);
}

function invitationsCol(clubId: string) {
  return clubRef(clubId).collection("invitations");
}

function userRef(uid: string) {
  return db().collection("users").doc(uid);
}

function memberAccountRef(clubId: string, accountUid: string) {
  return clubRef(clubId).collection("member_accounts").doc(accountUid);
}

function parseParentLinks(raw: unknown): ParentLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      clubId: String(item.clubId ?? ""),
      memberId: String(item.memberId ?? ""),
      relation: String(item.relation ?? RELATION_PARENT),
      status: String(item.status ?? GUARDIAN_STATUS_PENDING),
    }))
    .filter((link) => link.clubId.length > 0 && link.memberId.length > 0);
}

function upsertParentLink(links: ParentLink[], next: ParentLink): ParentLink[] {
  const without = links.filter(
    (link) => !(link.clubId === next.clubId && link.memberId === next.memberId),
  );
  return [...without, next];
}

function parentClubIdsFromLinks(links: ParentLink[]): string[] {
  return [...new Set(links.filter((link) => link.status === GUARDIAN_STATUS_ACTIVE).map((link) => link.clubId))];
}

async function assertClubAdmin(clubId: string, uid: string): Promise<DocumentData> {
  const clubSnap = await clubRef(clubId).get();
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }
  const club = clubSnap.data()!;
  const adminIds = Array.isArray(club.adminIds) ? club.adminIds.map(String) : [];
  if (adminIds.includes(uid)) {
    return club;
  }

  const accountSnap = await memberAccountRef(clubId, uid).get();
  const linkedMemberId = accountSnap.exists
    ? String(accountSnap.data()?.memberId ?? "")
    : uid;
  const memberSnap = await memberRef(clubId, linkedMemberId).get();
  if (memberSnap.exists && memberSnap.data()?.role === "admin") {
    return club;
  }

  throw new HttpsError("permission-denied", "Réservé aux admins du club");
}

async function resolveCallerMemberId(clubId: string, uid: string): Promise<string | null> {
  const accountSnap = await memberAccountRef(clubId, uid).get();
  if (accountSnap.exists) {
    const linked = String(accountSnap.data()?.memberId ?? "").trim();
    if (linked) return linked;
  }
  const selfSnap = await memberRef(clubId, uid).get();
  if (selfSnap.exists) return uid;
  return null;
}

function guardianPermissions(data: DocumentData | undefined): GuardianPermissions {
  const raw = (data?.permissions as Record<string, unknown> | undefined) ?? {};
  return {
    canView: raw.canView !== false,
    canRsvp: raw.canRsvp !== false,
    canPay: raw.canPay !== false,
  };
}

/**
 * Vérifie que l’appelant agit pour sa propre fiche ou comme parent active.
 */
export async function assertCanActForMember(params: {
  clubId: string;
  memberId: string;
  uid: string;
  permission: "canRsvp" | "canPay";
}): Promise<void> {
  const ownMemberId = await resolveCallerMemberId(params.clubId, params.uid);
  if (ownMemberId === params.memberId) return;

  const snap = await guardianRef(params.clubId, params.memberId, params.uid).get();
  if (!snap.exists) {
    throw new HttpsError(
      "permission-denied",
      "Tu ne peux pas agir pour ce membre",
    );
  }
  const data = snap.data()!;
  if (data.status !== GUARDIAN_STATUS_ACTIVE) {
    throw new HttpsError("permission-denied", "Lien parent inactif");
  }
  const permissions = guardianPermissions(data);
  if (!permissions[params.permission]) {
    throw new HttpsError("permission-denied", "Droit insuffisant");
  }
}

function isCapStatus(status: string): boolean {
  return status === GUARDIAN_STATUS_ACTIVE || status === GUARDIAN_STATUS_PENDING;
}

async function countGuardiansOccupyingSlot(
  clubId: string,
  memberId: string,
): Promise<number> {
  const guardiansSnap = await memberRef(clubId, memberId).collection("guardians").get();
  let count = 0;
  for (const docSnap of guardiansSnap.docs) {
    const status = String(docSnap.data().status ?? "");
    if (isCapStatus(status)) count += 1;
  }
  if (count > 0) return count;

  const invitesSnap = await invitationsCol(clubId)
    .where("memberId", "==", memberId)
    .where("status", "==", "pending")
    .get();
  return invitesSnap.docs.filter(
    (inviteDoc) => inviteDoc.data().type === INVITATION_TYPE_GUARDIAN,
  ).length;
}

function childAccountUid(memberData: DocumentData, memberId: string): string | null {
  const accountUid = String(memberData.accountUid ?? "").trim();
  if (accountUid) return accountUid;
  const userId = String(memberData.userId ?? "").trim();
  if (userId) return userId;
  return memberId;
}

async function writeGuardianAndParentLinks(params: {
  clubId: string;
  memberId: string;
  parentUid: string;
  relation: string;
  status: string;
  invitedBy: string;
}): Promise<void> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const gRef = guardianRef(params.clubId, params.memberId, params.parentUid);
  const uRef = userRef(params.parentUid);

  await db().runTransaction(async (tx) => {
    const userSnap = await tx.get(uRef);
    const existingLinks = userSnap.exists
      ? parseParentLinks(userSnap.data()?.parentLinks)
      : [];
    const nextLinks = upsertParentLink(existingLinks, {
      clubId: params.clubId,
      memberId: params.memberId,
      relation: params.relation,
      status: params.status,
    });
    const guardianSnap = await tx.get(gRef);
    const guardianPayload: Record<string, unknown> = {
      parentUid: params.parentUid,
      clubId: params.clubId,
      memberId: params.memberId,
      relation: params.relation,
      status: params.status,
      permissions: { canView: true, canRsvp: true, canPay: true },
      invitedBy: params.invitedBy,
      updatedAt: now,
    };
    if (!guardianSnap.exists) {
      guardianPayload.createdAt = now;
    }
    if (params.status === GUARDIAN_STATUS_REVOKED) {
      guardianPayload.revokedAt = now;
    }

    tx.set(gRef, guardianPayload, { merge: true });

    if (!userSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Le compte parent n’a pas encore de profil",
      );
    }
    tx.update(uRef, {
      parentLinks: nextLinks,
      parentClubIds: parentClubIdsFromLinks(nextLinks),
      updatedAt: now,
    });
  });
}

/**
 * Admin : invite un parent sur une fiche joueur (plafond V1 = 1).
 */
export const inviteGuardian = onCall(async (request) => {
  const adminUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  const email = normalizeEmail(requireString(request.data?.email, "email"));
  const relation = RELATION_PARENT;

  const club = await assertClubAdmin(clubId, adminUid);

  const memberSnap = await memberRef(clubId, memberId).get();
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Fiche membre introuvable");
  }
  const member = memberSnap.data()!;
  const childUid = childAccountUid(member, memberId);

  let existingParentUid: string | null = null;
  try {
    const authUser = await admin.auth().getUserByEmail(email);
    existingParentUid = authUser.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") {
      throw error;
    }
  }

  if (existingParentUid && (existingParentUid === childUid || existingParentUid === memberId)) {
    throw new HttpsError(
      "failed-precondition",
      "Impossible de lier un adulte à sa propre fiche",
    );
  }
  if (adminUid === childUid && existingParentUid === adminUid) {
    throw new HttpsError(
      "failed-precondition",
      "Impossible de lier un adulte à sa propre fiche",
    );
  }

  const occupying = await countGuardiansOccupyingSlot(clubId, memberId);
  if (occupying >= MAX_ACTIVE_GUARDIANS_PER_MEMBER) {
    throw new HttpsError(
      "failed-precondition",
      "Un parent est déjà lié ou invité pour cet enfant",
    );
  }

  const inviteRef = invitationsCol(clubId).doc();
  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await inviteRef.set({
    type: INVITATION_TYPE_GUARDIAN,
    memberId,
    email,
    relation,
    status: "pending",
    code,
    sentBy: adminUid,
    sentAt: now,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    clubName: String(club.name ?? ""),
    clubSport: String(club.sport ?? ""),
  });

  if (existingParentUid) {
    try {
      await writeGuardianAndParentLinks({
        clubId,
        memberId,
        parentUid: existingParentUid,
        relation,
        status: GUARDIAN_STATUS_PENDING,
        invitedBy: adminUid,
      });
    } catch {
      // Invitation seule : linkGuardian activera les deux faces à la connexion.
    }
  }

  return {
    ok: true,
    invitationId: inviteRef.id,
    code,
    expiresAt: expiresAt.toISOString(),
    accountExists: Boolean(existingParentUid),
  };
});

async function findPendingGuardianInvitation(params: {
  clubId?: string;
  invitationId?: string;
  email: string;
}): Promise<{ clubId: string; invitationId: string; data: DocumentData }> {
  if (params.clubId && params.invitationId) {
    const snap = await invitationsCol(params.clubId).doc(params.invitationId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Invitation introuvable");
    }
    return { clubId: params.clubId, invitationId: snap.id, data: snap.data()! };
  }

  const snap = await db()
    .collectionGroup("invitations")
    .where("email", "==", params.email)
    .where("status", "==", "pending")
    .get();
  const match = snap.docs.find((docSnap) => docSnap.data().type === INVITATION_TYPE_GUARDIAN);
  if (!match) {
    throw new HttpsError("not-found", "Aucune invitation parent en attente");
  }
  const clubId = match.ref.parent.parent?.id;
  if (!clubId) {
    throw new HttpsError("not-found", "Invitation introuvable");
  }
  return { clubId, invitationId: match.id, data: match.data() };
}

/**
 * Adulte connecté : active le lien guardian + parentLinks (les deux faces).
 */
export const linkGuardian = onCall(async (request) => {
  const parentUid = requireUid(request);
  const email = normalizeEmail(
    String(request.auth?.token.email ?? request.data?.email ?? ""),
  );
  if (!email) {
    throw new HttpsError("failed-precondition", "E-mail du compte introuvable");
  }

  const clubIdArg =
    typeof request.data?.clubId === "string" ? request.data.clubId.trim() : "";
  const invitationIdArg =
    typeof request.data?.invitationId === "string"
      ? request.data.invitationId.trim()
      : "";

  const invitation = await findPendingGuardianInvitation({
    clubId: clubIdArg || undefined,
    invitationId: invitationIdArg || undefined,
    email,
  });

  const inviteEmail = normalizeEmail(String(invitation.data.email ?? ""));
  if (inviteEmail !== email) {
    throw new HttpsError(
      "permission-denied",
      "Cette invitation ne correspond pas à ton e-mail",
    );
  }
  if (invitation.data.type !== INVITATION_TYPE_GUARDIAN) {
    throw new HttpsError("failed-precondition", "Invitation parent invalide");
  }
  if (invitation.data.status !== "pending") {
    throw new HttpsError("failed-precondition", "Invitation déjà traitée");
  }

  const expiresAt = invitation.data.expiresAt as admin.firestore.Timestamp | undefined;
  if (expiresAt && expiresAt.toDate().getTime() < Date.now()) {
    throw new HttpsError("failed-precondition", "Invitation expirée");
  }

  const memberId = String(invitation.data.memberId ?? "").trim();
  if (!memberId) {
    throw new HttpsError("failed-precondition", "Fiche enfant manquante");
  }

  const memberSnap = await memberRef(invitation.clubId, memberId).get();
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Fiche membre introuvable");
  }
  const childUid = childAccountUid(memberSnap.data()!, memberId);
  if (parentUid === childUid || parentUid === memberId) {
    throw new HttpsError(
      "failed-precondition",
      "Impossible de lier un adulte à sa propre fiche",
    );
  }

  const occupying = await countGuardiansOccupyingSlot(invitation.clubId, memberId);
  const existingGuardian = await guardianRef(
    invitation.clubId,
    memberId,
    parentUid,
  ).get();
  const alreadyPendingForCaller =
    existingGuardian.exists &&
    isCapStatus(String(existingGuardian.data()?.status ?? ""));
  if (occupying >= MAX_ACTIVE_GUARDIANS_PER_MEMBER && !alreadyPendingForCaller) {
    throw new HttpsError(
      "failed-precondition",
      "Un parent est déjà lié pour cet enfant",
    );
  }

  const invitedBy = String(invitation.data.sentBy ?? "");
  await writeGuardianAndParentLinks({
    clubId: invitation.clubId,
    memberId,
    parentUid,
    relation: String(invitation.data.relation ?? RELATION_PARENT),
    status: GUARDIAN_STATUS_ACTIVE,
    invitedBy,
  });

  await invitationsCol(invitation.clubId).doc(invitation.invitationId).update({
    status: "accepted",
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    acceptedBy: parentUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, clubId: invitation.clubId, memberId };
});

/**
 * Admin : révoque le lien parent (les deux faces).
 */
export const revokeGuardian = onCall(async (request) => {
  const adminUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  await assertClubAdmin(clubId, adminUid);

  const parentUidArg =
    typeof request.data?.parentUid === "string"
      ? request.data.parentUid.trim()
      : "";

  let parentUid = parentUidArg;
  if (!parentUid) {
    const guardiansSnap = await memberRef(clubId, memberId).collection("guardians").get();
    const occupying = guardiansSnap.docs.find((docSnap) =>
      isCapStatus(String(docSnap.data().status ?? "")),
    );
    parentUid = occupying?.id ?? "";
  }
  if (!parentUid) {
    const invitesSnap = await invitationsCol(clubId)
      .where("memberId", "==", memberId)
      .where("status", "==", "pending")
      .get();
    const pendingInvite = invitesSnap.docs.find(
      (inviteDoc) => inviteDoc.data().type === INVITATION_TYPE_GUARDIAN,
    );
    if (pendingInvite) {
      await pendingInvite.ref.update({
        status: "declined",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }
    throw new HttpsError("not-found", "Aucun parent à révoquer");
  }

  const gRef = guardianRef(clubId, memberId, parentUid);
  const guardianSnap = await gRef.get();
  if (guardianSnap.exists) {
    await writeGuardianAndParentLinks({
      clubId,
      memberId,
      parentUid,
      relation: String(guardianSnap.data()?.relation ?? RELATION_PARENT),
      status: GUARDIAN_STATUS_REVOKED,
      invitedBy: String(guardianSnap.data()?.invitedBy ?? adminUid),
    });
  }

  const invitesSnap = await invitationsCol(clubId)
    .where("memberId", "==", memberId)
    .where("status", "==", "pending")
    .get();
  const batch = db().batch();
  for (const inviteDoc of invitesSnap.docs) {
    if (inviteDoc.data().type !== INVITATION_TYPE_GUARDIAN) continue;
    batch.update(inviteDoc.ref, {
      status: "declined",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return { ok: true };
});

/**
 * RSVP pour soi ou pour un enfant lié (clé events.rsvp[memberId]).
 */
export const setEventRsvp = onCall(async (request) => {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const eventId = requireString(request.data?.eventId, "eventId");
  const memberId = requireString(request.data?.memberId, "memberId");
  const value = String(request.data?.value ?? "").trim();
  if (!RSVP_VALUES.has(value)) {
    throw new HttpsError("invalid-argument", "Réponse RSVP invalide");
  }

  await assertCanActForMember({
    clubId,
    memberId,
    uid,
    permission: "canRsvp",
  });

  const eventRef = clubRef(clubId).collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new HttpsError("not-found", "Événement introuvable");
  }

  await eventRef.update({
    [`rsvp.${memberId}`]: value,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
