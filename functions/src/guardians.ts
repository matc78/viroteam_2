import * as admin from "firebase-admin";
import { newUniqueInviteCode } from "./inviteCodes";
import {
  normalizeEmail,
  parseParentLinks,
  requireString,
  requireUid,
  requireVerifiedEmail,
  stringArray,
  type ParentLink,
} from "./common";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { DocumentData, DocumentReference } from "firebase-admin/firestore";
import {
  buildGuyEmail,
  buildJoinUrl,
  brevoCallableSecrets,
  clubLogoUrlFromData,
  configuredAppStoreUrl,
  configuredPlayStoreUrl,
  resolveAuthEmail,
  trySendGuyTransactionalEmail,
} from "./email";
import { ServerAnalyticsEvents, captureClubEvent } from "./analytics";
import { db, defineDualCallable } from "./db";
import { recomputeParentTeamIdsSafe } from "./parentTeams";
import { loadClubAccess, permissionDenied } from "./permissions";
import { isSafeMemberMapKey, staffRsvpTargetDecision } from "./eventRsvpUtils";

const MAX_ACTIVE_GUARDIANS_PER_MEMBER = 1;
const INVITE_TTL_DAYS = 7;

const GUARDIAN_STATUS_PENDING = "pending";
const GUARDIAN_STATUS_ACTIVE = "active";
const GUARDIAN_STATUS_REVOKED = "revoked";
const INVITATION_TYPE_GUARDIAN = "guardian";
const RELATION_PARENT = "parent";
const RSVP_VALUES = new Set(["yes", "maybe", "no"]);

type GuardianPermissions = {
  canView: boolean;
  canRsvp: boolean;
  canPay: boolean;
};

function requireEmail(value: unknown, name = "email"): string {
  const email = normalizeEmail(requireString(value, name));
  if (!email.includes("@")) {
    throw new HttpsError("invalid-argument", "E-mail invalide");
  }
  return email;
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

function upsertParentLink(links: ParentLink[], next: ParentLink): ParentLink[] {
  const without = links.filter(
    (link) => !(link.clubId === next.clubId && link.memberId === next.memberId),
  );
  return [...without, next];
}

function parentClubIdsFromLinks(links: ParentLink[]): string[] {
  return [...new Set(links.filter((link) => link.status === GUARDIAN_STATUS_ACTIVE).map((link) => link.clubId))];
}

/**
 * Droit `manageMembers`, ou titulaire de la fiche membre cible.
 * Retourne les données du club.
 */
async function assertCanManageGuardian(params: {
  clubId: string;
  memberId: string;
  uid: string;
}): Promise<DocumentData> {
  const access = await loadClubAccess(params.clubId, params.uid);
  if (access.can("manageMembers")) return access.club;

  const memberSnap = await memberRef(params.clubId, params.memberId).get();
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Fiche membre introuvable");
  }
  // Une seule clé membre : la fiche d'un compte vit à members/{uid}.
  if (params.memberId === params.uid) return access.club;

  throw new HttpsError(
    "permission-denied",
    "Réservé au responsable des membres ou au titulaire de la fiche",
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
 * Retourne `forChild` à true quand il agit comme parent.
 */
export async function assertCanActForMember(params: {
  clubId: string;
  memberId: string;
  uid: string;
  permission: "canRsvp" | "canPay";
}): Promise<{ forChild: boolean }> {
  // Sa propre fiche : members/{uid}, qui doit exister.
  if (params.memberId === params.uid) {
    const ownSnap = await memberRef(params.clubId, params.uid).get();
    if (ownSnap.exists) return { forChild: false };
  }

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
  return { forChild: true };
}

function isCapStatus(status: string): boolean {
  return status === GUARDIAN_STATUS_ACTIVE || status === GUARDIAN_STATUS_PENDING;
}

/**
 * Nombre de liens parent occupant le plafond (guardians actifs / en attente,
 * sinon invitations parent `pending`). Lu dans [options.tx] si fourni, pour
 * que le contrôle du plafond et l'écriture soient atomiques.
 */
async function countGuardiansOccupyingSlot(
  clubId: string,
  memberId: string,
  options?: { excludeInvitationId?: string; tx?: admin.firestore.Transaction },
): Promise<number> {
  const tx = options?.tx;
  const guardiansQuery = memberRef(clubId, memberId).collection("guardians");
  const guardiansSnap = tx ? await tx.get(guardiansQuery) : await guardiansQuery.get();
  let count = 0;
  for (const docSnap of guardiansSnap.docs) {
    const status = String(docSnap.data().status ?? "");
    if (isCapStatus(status)) count += 1;
  }
  if (count > 0) return count;

  const invitesQuery = invitationsCol(clubId)
    .where("memberId", "==", memberId)
    .where("status", "==", "pending");
  const invitesSnap = tx ? await tx.get(invitesQuery) : await invitesQuery.get();
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
 * Envoie le mail d’invitation parent (soft-fail) et trace lastEmail* sur l’invite.
 */
async function sendGuardianInviteEmail(params: {
  clubId: string;
  club: DocumentData;
  member: DocumentData;
  email: string;
  code: string;
  inviteRef: DocumentReference;
  callerUid: string;
}): Promise<void> {
  const clubName =
    String(params.club.name ?? "").trim() || "ton club";
  const childFirstName = String(params.member.firstName ?? "").trim();
  const joinUrl = buildJoinUrl(params.code);
  const emailContent = buildGuyEmail({
    kind: "guardianInvite",
    clubId: params.clubId,
    clubName,
    clubLogoUrl: clubLogoUrlFromData(params.club as Record<string, unknown>),
    childFirstName,
    code: params.code,
    joinUrl,
    appStoreUrl: configuredAppStoreUrl(),
    playStoreUrl: configuredPlayStoreUrl(),
  });

  const brevoResult = await trySendGuyTransactionalEmail({
    toEmail: params.email,
    email: emailContent,
    context: `guardian-invite ${params.clubId}`,
  });

  const patch: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (brevoResult) {
    patch.lastEmailSentAt = admin.firestore.FieldValue.serverTimestamp();
    patch.lastEmailSentBy = params.callerUid;
    patch.lastEmailTo = params.email;
    patch.lastEmailMessageId = brevoResult.messageId || null;
    patch.lastEmailError = admin.firestore.FieldValue.delete();
  } else {
    patch.lastEmailError = "brevo_send_failed";
  }
  await params.inviteRef.update(patch);
}

/**
 * Admin ou titulaire de fiche : invite un parent (plafond V1 = 1).
 * Prod → v2-prod ; `inviteGuardianDev` → v2-dev.
 */
export const {
  prod: inviteGuardian,
  dev: inviteGuardianDev,
} = defineDualCallable(
  {
    secrets: [...brevoCallableSecrets],
    timeoutSeconds: 60,
  },
  async (request: CallableRequest) => {
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

  if (existingParentUid && existingParentUid === memberId) {
    throw new HttpsError(
      "failed-precondition",
      "Impossible de lier un adulte à sa propre fiche",
    );
  }

  const inviteRef = invitationsCol(clubId).doc();
  const code = await newUniqueInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Plafond compté et invitation écrite dans la même transaction : deux
  // invitations simultanées ne peuvent pas dépasser le plafond.
  await db().runTransaction(async (tx) => {
    const occupying = await countGuardiansOccupyingSlot(clubId, memberId, { tx });
    if (occupying >= MAX_ACTIVE_GUARDIANS_PER_MEMBER) {
      throw new HttpsError(
        "failed-precondition",
        "Un parent est déjà lié ou invité pour cet enfant",
      );
    }
    tx.set(inviteRef, {
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
    } catch (error) {
      // Seul cas attendu : le compte parent existe dans Auth mais n'a pas
      // encore de profil `users/{uid}` (`failed-precondition` levé par
      // writeGuardianAndParentLinks, transaction annulée). L'invitation seule
      // suffit : linkGuardian activera les deux faces à la connexion.
      const missingParentProfile =
        error instanceof HttpsError && error.code === "failed-precondition";
      if (!missingParentProfile) {
        // Erreur transitoire : on retire l'invitation pour que le plafond ne
        // bloque pas la relance, puis on remonte l'erreur.
        await inviteRef.delete().catch((cleanupError) => {
          console.error("inviteGuardian: nettoyage invitation échoué", {
            clubId,
            invitationId: inviteRef.id,
            cleanupError,
          });
        });
        throw error;
      }
    }
  }

  await sendGuardianInviteEmail({
    clubId,
    club,
    member,
    email,
    code,
    inviteRef,
    callerUid,
  });
  await captureClubEvent({
    clubId,
    event: ServerAnalyticsEvents.invitationSent,
    properties: { kind: "guardian", account_exists: Boolean(existingParentUid) },
  });

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
 * Prod → v2-prod ; `linkGuardianDev` → v2-dev.
 */
export const {
  prod: linkGuardian,
  dev: linkGuardianDev,
} = defineDualCallable(
  {
    secrets: [...brevoCallableSecrets],
    timeoutSeconds: 60,
  },
  async (request: CallableRequest) => {
  const parentUid = requireUid(request);
  const tokenEmail = request.auth?.token?.email;
  if (typeof tokenEmail !== "string" || !tokenEmail.trim()) {
    throw new HttpsError(
      "failed-precondition",
      "E-mail du compte introuvable — reconnecte-toi avec un compte e-mail",
    );
  }
  requireVerifiedEmail(request);
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
  const memberData = memberSnap.data()!;
  // Fiche liée : son id est l'uid du compte (une seule clé membre).
  if (parentUid === memberId) {
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

  // Le parent ne voit que les équipes de ses enfants : recalcul serveur.
  await recomputeParentTeamIdsSafe(db(), parentUid);

  await invitationsCol(invitation.clubId).doc(invitation.invitationId).update({
    status: "accepted",
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    acceptedBy: parentUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Soft-fail : confirmation à l’inviteur.
  if (invitedBy) {
    const inviterEmail = await resolveAuthEmail(invitedBy);
    if (inviterEmail) {
      const clubSnap = await clubRef(invitation.clubId).get();
      const club = clubSnap.data() ?? {};
      const clubName =
        String(club.name ?? invitation.data.clubName ?? "").trim() || "ton club";
      let parentDisplayName = "";
      try {
        const parentUser = await admin.auth().getUser(parentUid);
        parentDisplayName =
          parentUser.displayName?.trim() ||
          parentUser.email?.split("@")[0] ||
          "";
      } catch {
        parentDisplayName = email.split("@")[0] ?? "";
      }
      const childFirstName = String(memberData.firstName ?? "").trim();
      await trySendGuyTransactionalEmail({
        toEmail: inviterEmail,
        email: buildGuyEmail({
          kind: "inviteAcceptedGuardian",
          clubId: invitation.clubId,
          clubName,
          clubLogoUrl: clubLogoUrlFromData(club as Record<string, unknown>),
          parentDisplayName,
          childFirstName,
        }),
        context: `invite-accepted-guardian ${invitation.clubId}`,
      });
    }
  }

  await captureClubEvent({
    clubId: invitation.clubId,
    event: ServerAnalyticsEvents.guardianLinked,
  });

  return { ok: true, clubId: invitation.clubId, memberId };
});

/**
 * Admin ou titulaire de fiche : révoque le lien parent (purge parentLinks).
 * Prod → v2-prod ; `revokeGuardianDev` → v2-dev.
 */
export const {
  prod: revokeGuardian,
  dev: revokeGuardianDev,
} = defineDualCallable(async (request: CallableRequest) => {
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
    await recomputeParentTeamIdsSafe(db(), parentUid);
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
 * Prod → v2-prod ; `updateGuardianInviteEmailDev` → v2-dev.
 */
export const {
  prod: updateGuardianInviteEmail,
  dev: updateGuardianInviteEmailDev,
} = defineDualCallable(async (request: CallableRequest) => {
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
    await recomputeParentTeamIdsSafe(db(), guardianDoc.id);
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
    if (newParentUid !== memberId) {
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
 * Prod → v2-prod ; `extendGuardianInviteDev` → v2-dev.
 */
export const {
  prod: extendGuardianInvite,
  dev: extendGuardianInviteDev,
} = defineDualCallable(async (request: CallableRequest) => {
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
 * Prod → v2-prod ; `regenerateGuardianInviteDev` → v2-dev.
 */
export const {
  prod: regenerateGuardianInvite,
  dev: regenerateGuardianInviteDev,
} = defineDualCallable(
  {
    secrets: [...brevoCallableSecrets],
    timeoutSeconds: 60,
  },
  async (request: CallableRequest) => {
  const callerUid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const memberId = requireString(request.data?.memberId, "memberId");
  const invitationIdArg =
    typeof request.data?.invitationId === "string"
      ? request.data.invitationId.trim()
      : "";

  const club = await assertCanManageGuardian({ clubId, memberId, uid: callerUid });

  const invite = await loadPendingGuardianInvite({
    clubId,
    memberId,
    invitationId: invitationIdArg || undefined,
  });

  const code = await newUniqueInviteCode();
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

  const memberSnap = await memberRef(clubId, memberId).get();
  const member = memberSnap.exists ? memberSnap.data()! : {};
  const email = requireEmail(invite.data.email);

  await sendGuardianInviteEmail({
    clubId,
    club,
    member,
    email,
    code,
    inviteRef: invite.ref,
    callerUid,
  });

  return {
    ok: true,
    invitationId: invite.invitationId,
    code,
    expiresAt: expiresAt.toISOString(),
  };
});

/**
 * Droit `manageEvents`, ou coach d'une équipe de l'événement si le club active
 * `canEditMemberRsvp` (jamais sur un événement « tout le club »).
 */
async function assertCanEditMemberRsvpAsStaff(
  clubId: string,
  uid: string,
  event: Record<string, unknown>,
  targetMemberId: string,
): Promise<void> {
  const access = await loadClubAccess(clubId, uid);
  const canManageEvents = access.can("manageEvents");
  const coachAllowed =
    event.allTeams !== true &&
    access.coachCan("canEditMemberRsvp") &&
    access.coachesAnyTeam(stringArray(event.teamIds));
  if (!canManageEvents && !coachAllowed) {
    throw permissionDenied("Tu n’as pas le droit de modifier les réponses des joueurs");
  }
  // Cible : fiche existante, convoquée ; pour un coach, dans une de ses équipes.
  const targetSnap = await memberRef(clubId, targetMemberId).get();
  const decision = staffRsvpTargetDecision({
    event,
    targetMemberId,
    targetExists: targetSnap.exists,
    targetTeamIds: stringArray(targetSnap.data()?.teamIds),
    canManageEvents,
    coachTeamIds: access.coachTeamIds,
  });
  if (!decision.ok) {
    throw new HttpsError(decision.code, decision.reason);
  }
}

/**
 * RSVP pour soi, un enfant lié, ou (droit `manageEvents` / coach autorisé de
 * l'événement) un autre membre.
 * Prod → v2-prod ; `setEventRsvpDev` → v2-dev.
 */
export const {
  prod: setEventRsvp,
  dev: setEventRsvpDev,
} = defineDualCallable(async (request: CallableRequest) => {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const eventId = requireString(request.data?.eventId, "eventId");
  const memberId = requireString(request.data?.memberId, "memberId");
  // Clé de map : un « . » créerait un chemin imbriqué (`rsvp.a.b`).
  if (!isSafeMemberMapKey(memberId)) {
    throw new HttpsError("invalid-argument", "memberId invalide");
  }
  const value = String(request.data?.value ?? "").trim();
  if (!RSVP_VALUES.has(value)) {
    throw new HttpsError("invalid-argument", "Réponse RSVP invalide");
  }

  const eventRef = clubRef(clubId).collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new HttpsError("not-found", "Événement introuvable");
  }
  if (eventSnap.get("canceled") === true) {
    throw new HttpsError("failed-precondition", "Événement annulé");
  }

  let forChild = false;
  let via: "callable" | "staff" = "callable";
  try {
    const result = await assertCanActForMember({
      clubId,
      memberId,
      uid,
      permission: "canRsvp",
    });
    forChild = result.forChild;
  } catch (error) {
    if (!(error instanceof HttpsError) || error.code !== "permission-denied") {
      throw error;
    }
    await assertCanEditMemberRsvpAsStaff(clubId, uid, eventSnap.data() ?? {}, memberId);
    via = "staff";
  }

  await eventRef.update({
    [`rsvp.${memberId}`]: value,
    [`rsvpUpdatedAt.${memberId}`]:
      admin.firestore.FieldValue.serverTimestamp(),
    rsvpLastActorUid: uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  // Le trigger events ignore les écritures serveur : la réponse est comptée ici.
  await captureClubEvent({
    clubId,
    event: ServerAnalyticsEvents.rsvpSet,
    properties: { status: value, for_child: forChild, via },
  });

  return { ok: true };
});

/**
 * Marque un événement « vu » pour soi ou un enfant lié (clé events.seenAt[memberId]).
 * Idempotent : la première vue est conservée. Pas d'`updatedAt` (suivi silencieux).
 * Prod → v2-prod ; `markEventSeenDev` → v2-dev.
 */
export const {
  prod: markEventSeen,
  dev: markEventSeenDev,
} = defineDualCallable(async (request: CallableRequest) => {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const eventId = requireString(request.data?.eventId, "eventId");
  const memberId = requireString(request.data?.memberId, "memberId");
  if (!isSafeMemberMapKey(memberId)) {
    throw new HttpsError("invalid-argument", "memberId invalide");
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
  const seenAt = eventSnap.get("seenAt");
  if (seenAt && typeof seenAt === "object" && seenAt[memberId] != null) {
    return { ok: true };
  }

  await eventRef.update({
    [`seenAt.${memberId}`]: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
