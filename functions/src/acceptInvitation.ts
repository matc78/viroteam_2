import * as admin from "firebase-admin";
import type {
  DocumentReference,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { parseAcceptInvitationArgs } from "./acceptInvitationArgs";
import { db, defineDualCallable } from "./db";

export { parseAcceptInvitationArgs } from "./acceptInvitationArgs";

const INVITATION_TYPE_GUARDIAN = "guardian";
const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_ACCEPTED = "accepted";
const ROLE_ADMIN = "admin";
const ROLE_PLAYER = "player";
const ROLE_COACH = "coach";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolvedDisplayName(
  userData: Record<string, unknown> | undefined,
  authEmail: string | undefined,
): string {
  const fromProfile = String(userData?.displayName ?? "").trim();
  if (fromProfile.length > 0) return fromProfile;
  const first = String(userData?.firstName ?? "").trim();
  const last = String(userData?.lastName ?? "").trim();
  const combined = `${first} ${last}`.trim();
  if (combined.length > 0) return combined;
  return authEmail?.trim() ?? "";
}

function memberProfilePatch(params: {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}): Record<string, unknown> {
  return {
    firstName: params.firstName,
    lastName: params.lastName,
    snapshot: {
      displayName: params.displayName,
      email: params.email,
      ...(params.avatarUrl ? { avatarUrl: params.avatarUrl } : {}),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function reconcileRosterIds(params: {
  clubId: string;
  legacyMemberId: string;
  authUid: string;
}): Promise<void> {
  const { clubId, legacyMemberId, authUid } = params;
  if (!legacyMemberId || !authUid || legacyMemberId === authUid) return;

  const teams = db().collection("clubs").doc(clubId).collection("teams");
  const [playerSnap, coachSnap, pendingSnap] = await Promise.all([
    teams.where("playerIds", "array-contains", legacyMemberId).get(),
    teams.where("coachIds", "array-contains", legacyMemberId).get(),
    teams.where("pendingPlayerIds", "array-contains", legacyMemberId).get(),
  ]);

  type Patch = Record<string, unknown>;
  const updates = new Map<DocumentReference, Patch>();

  const mergePatch = (ref: DocumentReference, patch: Patch) => {
    updates.set(ref, { ...(updates.get(ref) ?? {}), ...patch });
  };

  const patchTeam = (
    doc: QueryDocumentSnapshot,
    field: string,
    promoteToPlayers: boolean,
  ) => {
    const data = doc.data();
    const ids = Array.isArray(data[field])
      ? (data[field] as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    if (!ids.includes(legacyMemberId)) return;

    const next = [...new Set(ids.map((id) => (id === legacyMemberId ? authUid : id)))];
    const patch: Patch = { [field]: next };
    if (promoteToPlayers) {
      const players = new Set(
        Array.isArray(data.playerIds)
          ? (data.playerIds as unknown[]).filter((id): id is string => typeof id === "string")
          : [],
      );
      players.add(authUid);
      patch.playerIds = [...players];
      const pending = Array.isArray(data.pendingPlayerIds)
        ? (data.pendingPlayerIds as unknown[]).filter((id): id is string => typeof id === "string")
        : [];
      patch.pendingPlayerIds = pending.filter((id) => id !== legacyMemberId);
    }
    mergePatch(doc.ref, patch);
  };

  for (const doc of playerSnap.docs) {
    patchTeam(doc, "playerIds", false);
  }
  for (const doc of coachSnap.docs) {
    patchTeam(doc, "coachIds", false);
  }
  for (const doc of pendingSnap.docs) {
    patchTeam(doc, "pendingPlayerIds", true);
  }

  if (updates.size === 0) return;
  const batch = db().batch();
  for (const [ref, patch] of updates) {
    batch.update(ref, patch);
  }
  await batch.commit();
}

async function deleteOrphanPendingMembers(params: {
  clubId: string;
  email: string;
}): Promise<void> {
  const normalized = normalizeEmail(params.email);
  if (!normalized) return;

  const snap = await db()
    .collection("clubs")
    .doc(params.clubId)
    .collection("pending_members")
    .where("email", "==", normalized)
    .get();
  if (snap.empty) return;

  const batch = db().batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

/**
 * Accepte une invitation membre (transaction Admin SDK).
 * Refuse type guardian — utiliser linkGuardian.
 */
async function handleAcceptInvitation(
  request: CallableRequest,
): Promise<{ ok: true; memberId: string }> {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  const uid = request.auth.uid;
  const authEmail = request.auth.token.email as string | undefined;
  const { clubId, invitationId } = parseAcceptInvitationArgs(request.data);

  const clubRef = db().collection("clubs").doc(clubId);
  const inviteRef = clubRef.collection("invitations").doc(invitationId);
  const userRef = db().collection("users").doc(uid);

  const result = await db().runTransaction(async (tx) => {
    const [inviteSnap, userSnap, clubSnap] = await Promise.all([
      tx.get(inviteRef),
      tx.get(userRef),
      tx.get(clubRef),
    ]);

    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "Invitation introuvable");
    }
    const invite = inviteSnap.data()!;
    if (String(invite.status ?? "") !== INVITATION_STATUS_PENDING) {
      throw new HttpsError("failed-precondition", "Invitation déjà traitée");
    }
    if (String(invite.type ?? "member") === INVITATION_TYPE_GUARDIAN) {
      throw new HttpsError(
        "failed-precondition",
        "Invitation parent : utilise linkGuardian",
      );
    }

    const expiresAt = invite.expiresAt?.toDate?.() as Date | undefined;
    if (expiresAt && Date.now() > expiresAt.getTime()) {
      throw new HttpsError("failed-precondition", "Invitation expirée");
    }

    const inviteEmail =
      typeof invite.email === "string" ? normalizeEmail(invite.email) : "";
    const userEmail = normalizeEmail(
      String(userSnap.data()?.emailNorm ?? userSnap.data()?.email ?? authEmail ?? ""),
    );
    if (inviteEmail && userEmail && inviteEmail !== userEmail) {
      throw new HttpsError(
        "permission-denied",
        "Cette invitation est réservée à un autre email",
      );
    }

    const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
    const firstName = String(userData.firstName ?? "").trim();
    const lastName = String(userData.lastName ?? "").trim();
    const displayName = resolvedDisplayName(userData, authEmail);
    const email = userEmail || authEmail?.trim() || "";
    const avatarUrl =
      typeof userData.avatarUrl === "string" ? userData.avatarUrl : null;
    const profilePatch = memberProfilePatch({
      firstName,
      lastName,
      displayName,
      email,
      avatarUrl,
    });

    const linkedMemberId =
      typeof invite.memberId === "string" && invite.memberId.trim().length > 0
        ? invite.memberId.trim()
        : "";
    const memberId = linkedMemberId || uid;
    const memberRef = clubRef.collection("members").doc(memberId);
    const accountIndexRef = clubRef.collection("member_accounts").doc(uid);
    const memberSnap = await tx.get(memberRef);
    const role = String(invite.role ?? ROLE_PLAYER);

    if (linkedMemberId) {
      if (!memberSnap.exists) {
        throw new HttpsError("not-found", "Membre du club introuvable");
      }
      tx.update(memberRef, {
        accountUid: uid,
        userId: uid,
        ...profilePatch,
        activeInvitationId: admin.firestore.FieldValue.delete(),
      });
      tx.set(accountIndexRef, { linkedMemberId });
    } else if (!memberSnap.exists) {
      tx.set(memberRef, {
        memberId: uid,
        accountUid: uid,
        userId: uid,
        firstName,
        lastName,
        role,
        status: "active",
        teamIds: [],
        snapshot: {
          displayName,
          email,
          ...(avatarUrl ? { avatarUrl } : {}),
        },
        ...(role === ROLE_PLAYER ? { playerInfo: { license: "" } } : {}),
        ...(role === ROLE_COACH ? { coachInfo: { headCoach: false } } : {}),
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const memberCount = Number(clubSnap.data()?.memberCount ?? 0);
      tx.update(clubRef, {
        memberCount: memberCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(memberRef, {
        accountUid: uid,
        userId: uid,
        ...profilePatch,
      });
    }

    if (role === ROLE_ADMIN && clubSnap.exists) {
      const adminIds = Array.isArray(clubSnap.data()?.adminIds)
        ? (clubSnap.data()!.adminIds as unknown[]).filter(
            (id): id is string => typeof id === "string",
          )
        : [];
      if (!adminIds.includes(uid)) {
        tx.update(clubRef, {
          adminIds: [...adminIds, uid],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    const memberships = Array.isArray(userData.clubMemberships)
      ? (userData.clubMemberships as unknown[]).filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object",
        )
      : [];
    const already = memberships.some((m) => String(m.clubId ?? "") === clubId);
    if (!already) {
      memberships.push({ clubId, role });
      tx.set(
        userRef,
        {
          clubMemberships: memberships,
          flags: {
            profileCompleted: true,
            disabled: false,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    tx.update(inviteRef, {
      status: INVITATION_STATUS_ACCEPTED,
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedBy: uid,
      firstName,
      lastName,
    });

    return { memberId, linkedMemberId, email };
  });

  if (
    result.linkedMemberId &&
    result.linkedMemberId.length > 0 &&
    result.linkedMemberId !== uid
  ) {
    await reconcileRosterIds({
      clubId,
      legacyMemberId: result.linkedMemberId,
      authUid: uid,
    });
  }

  if (result.email) {
    await deleteOrphanPendingMembers({ clubId, email: result.email });
  }

  return { ok: true, memberId: result.memberId };
}

/**
 * Prod → v2-prod ; `acceptInvitationDev` → v2-dev.
 */
export const {
  prod: acceptInvitation,
  dev: acceptInvitationDev,
} = defineDualCallable(handleAcceptInvitation);
