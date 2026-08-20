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

function requireEmail(value: unknown, name = "email"): string {
  const email = normalizeEmail(requireString(value, name));
  if (!email.includes("@")) {
    throw new HttpsError("invalid-argument", "E-mail invalide");
  }
  return email;
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

/** Vérifie que l’uid est admin du club (adminIds ou fiche role admin). */
export async function assertClubAdmin(
  clubId: string,
  uid: string,
): Promise<DocumentData> {
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

async function isClubAdmin(clubId: string, uid: string): Promise<boolean> {
  try {
    await assertClubAdmin(clubId, uid);
    return true;
  } catch (error) {
    if (error instanceof HttpsError && error.code === "permission-denied") {
      return false;
    }
    throw error;
  }
}

/**
 * Admin du club, ou propriétaire Auth de la fiche membre cible.
 */
async function assertCanManageGuardian(params: {
  clubId: string;
  memberId: string;
  uid: string;
}): Promise<DocumentData> {
  const clubSnap = await clubRef(params.clubId).get();
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }
  const club = clubSnap.data()!;

  if (await isClubAdmin(params.clubId, params.uid)) {
    return club;
  }

  const memberSnap = await memberRef(params.clubId, params.memberId).get();
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Fiche membre introuvable");
  }
  const ownerUid = childAccountUid(memberSnap.data()!, params.memberId);
  if (ownerUid && ownerUid === params.uid) {
    return club;
  }

  throw new HttpsError(
    "permission-denied",
    "Réservé à l’admin ou au titulaire de la fiche",
  );
}

/** Retire le lien parent↔enfant du profil user (pas de soft-status). */
function removeParentLink(
  links: ParentLink[],
  clubId: string,
  memberId: string,
): ParentLink[] {
  return links.filter(
    (link) => !(link.clubId === clubId && link.memberId === memberId),
  );
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
  options?: { excludeInvitationId?: string },
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
  return invitesSnap.docs.filter((inviteDoc) => {
    if (inviteDoc.data().type !== INVITATION_TYPE_GUARDIAN) return false;
    if (
      options?.excludeInvitationId &&
      inviteDoc.id === options.excludeInvitationId
    ) {
      return false;
    }
    return true;
  }).length;
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
  const isRevoked = params.status === GUARDIAN_STATUS_REVOKED;

  await db().runTransaction(async (tx) => {
    const userSnap = await tx.get(uRef);
    const existingLinks = userSnap.exists
      ? parseParentLinks(userSnap.data()?.parentLinks)
      : [];
    const nextLinks = isRevoked
      ? removeParentLink(existingLinks, params.clubId, params.memberId)
      : upsertParentLink(existingLinks, {
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
    if (isRevoked) {
      guardianPayload.revokedAt = now;
    }

    tx.set(gRef, guardianPayload, { merge: true });

    if (!userSnap.exists) {
      if (isRevoked) {
        // Révocation sans profil user : le doc guardian suffit.
        return;
      }
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

async function findPendingGuardianInviteForMember(
  clubId: string,
  memberId: string,
): Promise<admin.firestore.QueryDocumentSnapshot | null> {
  const invitesSnap = await invitationsCol(clubId)
    .where("memberId", "==", memberId)
    .where("status", "==", "pending")
    .get();
  const pendingInvite = invitesSnap.docs.find(
    (inviteDoc) => inviteDoc.data().type === INVITATION_TYPE_GUARDIAN,
  );
  return pendingInvite ?? null;
}

/** Charge une invitation guardian pending (par id ou membre). */
async function loadPendingGuardianInvite(params: {
  clubId: string;
  memberId: string;
  invitationId?: string;
}): Promise<{
  ref: admin.firestore.DocumentReference;
  data: DocumentData;
  invitationId: string;
}> {
  if (params.invitationId) {
    const inviteRef = invitationsCol(params.clubId).doc(params.invitationId);
    const snap = await inviteRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Invitation introuvable");
    }
    const data = snap.data()!;
    if (data.type !== INVITATION_TYPE_GUARDIAN) {
      throw new HttpsError("failed-precondition", "Invitation parent invalide");
    }
    if (data.status !== "pending") {
      throw new HttpsError("failed-precondition", "Invitation déjà traitée");
    }
    if (String(data.memberId ?? "") !== params.memberId) {
      throw new HttpsError("failed-precondition", "Invitation hors fiche");
    }
    return { ref: inviteRef, data, invitationId: snap.id };
  }

  const pending = await findPendingGuardianInviteForMember(
    params.clubId,
    params.memberId,
  );
  if (!pending) {
    throw new HttpsError("not-found", "Aucune invitation parent en attente");
  }
  return {
    ref: pending.ref,
    data: pending.data(),
    invitationId: pending.id,
  };
}

/**
 * Admin ou titulaire de fiche : invite un parent (plafond V1 = 1).
 */
export const inviteGuardian = onCall(async (request) => {
  const callerUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  const email = requireEmail(request.data?.email);
  const relation = RELATION_PARENT;

  const club = await assertCanManageGuardian({
    clubId,
    memberId,
    uid: callerUid,
  });

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
    sentBy: callerUid,
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
        invitedBy: callerUid,
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
  const matches = snap.docs.filter(
    (docSnap) => docSnap.data().type === INVITATION_TYPE_GUARDIAN,
  );
  if (matches.length === 0) {
    throw new HttpsError("not-found", "Aucune invitation parent en attente");
  }
  matches.sort((a, b) => {
    const aExp = (a.data().expiresAt as admin.firestore.Timestamp | undefined)
      ?.toMillis?.() ?? 0;
    const bExp = (b.data().expiresAt as admin.firestore.Timestamp | undefined)
      ?.toMillis?.() ?? 0;
    return bExp - aExp;
  });
  const match = matches[0]!;
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
  const tokenEmail = request.auth?.token?.email;
  if (typeof tokenEmail !== "string" || !tokenEmail.trim()) {
    throw new HttpsError(
      "failed-precondition",
      "E-mail du compte introuvable — reconnecte-toi avec un compte e-mail",
    );
  }
  const email = normalizeEmail(tokenEmail);

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

  const occupying = await countGuardiansOccupyingSlot(
    invitation.clubId,
    memberId,
    { excludeInvitationId: invitation.invitationId },
  );
  const existingGuardian = await guardianRef(
    invitation.clubId,
    memberId,
    parentUid,
  ).get();
  const alreadyPendingForCaller =
    existingGuardian.exists &&
    isCapStatus(String(existingGuardian.data()?.status ?? ""));
  // L’invitation courante ne compte pas (excludeInvitationId). Un autre
  // guardian active/pending, ou une autre invite, bloque toujours.
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
 * Admin ou titulaire de fiche : révoque le lien parent (purge parentLinks).
 */
export const revokeGuardian = onCall(async (request) => {
  const callerUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  await assertCanManageGuardian({ clubId, memberId, uid: callerUid });

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
    const pendingInvite = await findPendingGuardianInviteForMember(
      clubId,
      memberId,
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
      invitedBy: String(guardianSnap.data()?.invitedBy ?? callerUid),
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
 * Admin ou titulaire : change l’e-mail d’une invitation parent encore pending.
 */
export const updateGuardianInviteEmail = onCall(async (request) => {
  const callerUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  const email = requireEmail(request.data?.email);
  const invitationIdArg =
    typeof request.data?.invitationId === "string"
      ? request.data.invitationId.trim()
      : "";

  await assertCanManageGuardian({ clubId, memberId, uid: callerUid });

  const guardiansSnap = await memberRef(clubId, memberId).collection("guardians").get();
  const activeGuardian = guardiansSnap.docs.find(
    (docSnap) => String(docSnap.data().status ?? "") === GUARDIAN_STATUS_ACTIVE,
  );
  if (activeGuardian) {
    throw new HttpsError(
      "failed-precondition",
      "Impossible de changer l’e-mail d’un parent déjà connecté",
    );
  }

  const invite = await loadPendingGuardianInvite({
    clubId,
    memberId,
    invitationId: invitationIdArg || undefined,
  });

  // Révoque les guardians pending de l’ancien e-mail (sinon le slot V1 reste pris).
  for (const guardianDoc of guardiansSnap.docs) {
    if (!isCapStatus(String(guardianDoc.data().status ?? ""))) continue;
    await writeGuardianAndParentLinks({
      clubId,
      memberId,
      parentUid: guardianDoc.id,
      relation: String(guardianDoc.data().relation ?? RELATION_PARENT),
      status: GUARDIAN_STATUS_REVOKED,
      invitedBy: String(guardianDoc.data().invitedBy ?? callerUid),
    });
  }

  await invite.ref.update({
    email,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  let newParentUid: string | null = null;
  try {
    const authUser = await admin.auth().getUserByEmail(email);
    newParentUid = authUser.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") {
      throw error;
    }
  }
  if (newParentUid) {
    const memberSnap = await memberRef(clubId, memberId).get();
    const childUid = memberSnap.exists
      ? childAccountUid(memberSnap.data()!, memberId)
      : null;
    if (newParentUid !== childUid && newParentUid !== memberId) {
      await writeGuardianAndParentLinks({
        clubId,
        memberId,
        parentUid: newParentUid,
        relation: RELATION_PARENT,
        status: GUARDIAN_STATUS_PENDING,
        invitedBy: callerUid,
      });
    }
  }

  return { ok: true, invitationId: invite.invitationId, email };
});

/**
 * Admin ou titulaire : prolonge l’expiration d’une invitation parent pending.
 */
export const extendGuardianInvite = onCall(async (request) => {
  const callerUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  const invitationIdArg =
    typeof request.data?.invitationId === "string"
      ? request.data.invitationId.trim()
      : "";

  await assertCanManageGuardian({ clubId, memberId, uid: callerUid });

  const invite = await loadPendingGuardianInvite({
    clubId,
    memberId,
    invitationId: invitationIdArg || undefined,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  const code = String(invite.data.code ?? "").trim();

  await invite.ref.update({
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    invitationId: invite.invitationId,
    code,
    expiresAt: expiresAt.toISOString(),
  };
});

/**
 * Admin ou titulaire : nouveau code + reset expiration (renvoyer l’invite).
 */
export const regenerateGuardianInvite = onCall(async (request) => {
  const callerUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  const invitationIdArg =
    typeof request.data?.invitationId === "string"
      ? request.data.invitationId.trim()
      : "";

  await assertCanManageGuardian({ clubId, memberId, uid: callerUid });

  const invite = await loadPendingGuardianInvite({
    clubId,
    memberId,
    invitationId: invitationIdArg || undefined,
  });

  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await invite.ref.update({
    code,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    sentBy: callerUid,
    sentAt: now,
    updatedAt: now,
  });

  return {
    ok: true,
    invitationId: invite.invitationId,
    code,
    expiresAt: expiresAt.toISOString(),
  };
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
