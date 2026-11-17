import * as admin from "firebase-admin";
import {
  normalizeEmail,
  requireVerifiedEmail,
  resolvedDisplayName,
  stringArray,
} from "./common";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { parseAcceptInvitationArgs } from "./acceptInvitationArgs";
import {
  MemberRekeyError,
  readRekeyCore,
  rewriteMemberReferencesWithRetry,
  writeRekeyCore,
} from "./memberRekey";
import {
  buildGuyEmail,
  brevoCallableSecrets,
  clubLogoUrlFromData,
  normalizeMemberInviteRole,
  resolveAuthEmail,
  trySendGuyTransactionalEmail,
} from "./email";
import {
  ServerAnalyticsEvents,
  captureClubEvent,
  clubMemberCount,
} from "./analytics";
import { db, defineDualCallable } from "./db";
import { mergeMemberDocs } from "./memberRekeyPlan";
import {
  adminIdsUpdate,
  primaryBadge,
} from "./permissionsCatalog";

export { parseAcceptInvitationArgs } from "./acceptInvitationArgs";

const INVITATION_TYPE_GUARDIAN = "guardian";
const INVITATION_TYPE_TEAM = "team";
const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_ACCEPTED = "accepted";

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
 * Accepte une invitation membre (transaction Admin SDK). Une invitation ne
 * porte aucun droit : ils vivent sur la fiche pré-créée et suivent le
 * re-keying ; une fiche créée ici n'en a aucun.
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
  // L'e-mail du compte Auth est la seule identité comparée à l'invitation.
  const authEmailNorm = normalizeEmail(authEmail ?? "");
  if (!authEmailNorm) {
    throw new HttpsError(
      "failed-precondition",
      "E-mail du compte introuvable — reconnecte-toi avec un compte e-mail",
    );
  }
  requireVerifiedEmail(request);
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
    if (String(invite.type ?? "member") === INVITATION_TYPE_TEAM) {
      throw new HttpsError(
        "failed-precondition",
        "Invitation d’équipe : utilise acceptTeamInvitation",
      );
    }

    const expiresAt = invite.expiresAt?.toDate?.() as Date | undefined;
    if (expiresAt && Date.now() > expiresAt.getTime()) {
      throw new HttpsError("failed-precondition", "Invitation expirée");
    }

    // Décision produit : une invitation n'est acceptable QUE par l'e-mail invité.
    const inviteEmail =
      typeof invite.email === "string" ? normalizeEmail(invite.email) : "";
    if (!inviteEmail) {
      throw new HttpsError(
        "failed-precondition",
        "Invitation sans e-mail — demande à l'admin de la renvoyer",
      );
    }
    if (inviteEmail !== authEmailNorm) {
      throw new HttpsError(
        "permission-denied",
        "Cette invitation est réservée à un autre email",
      );
    }

    const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
    const firstName = String(userData.firstName ?? "").trim();
    const lastName = String(userData.lastName ?? "").trim();
    const displayName = resolvedDisplayName(userData, authEmail);
    const email = authEmailNorm;
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
    // Une seule clé membre : la fiche pré-inscrite est re-clée sur l'uid.
    const rekeyFrom = linkedMemberId && linkedMemberId !== uid ? linkedMemberId : "";
    const memberId = uid;
    const memberRef = clubRef.collection("members").doc(memberId);
    const memberSnap = await tx.get(memberRef);
    const rekeyState = rekeyFrom
      ? await readRekeyCore(tx, { firestore: db(), clubId, fromMemberId: rekeyFrom, uid })
      : null;
    // Fiche telle qu'elle sera une fois liée (badge de l'e-mail de retour).
    const linkedMember = rekeyState?.source.exists
      ? rekeyState.target.exists
        ? mergeMemberDocs(rekeyState.source.data()!, rekeyState.target.data()!)
        : rekeyState.source.data()!
      : (memberSnap.data() ?? {});
    const role = primaryBadge(linkedMember);

    if (rekeyState) {
      try {
        // Une fiche déjà à l'uid (doublon) est fusionnée : l'invitation vise
        // la fiche pré-inscrite, la personne n'en garde qu'une.
        writeRekeyCore(tx, rekeyState, {
          extraFields: profilePatch,
          mergeDuplicates: true,
        });
      } catch (error) {
        if (error instanceof MemberRekeyError) {
          throw new HttpsError(
            error.code === "source-missing" ? "not-found" : "failed-precondition",
            error.code === "source-missing" ? "Membre du club introuvable" : error.message,
          );
        }
        throw error;
      }
    } else if (!memberSnap.exists) {
      tx.set(memberRef, {
        accountUid: uid,
        firstName,
        lastName,
        permissions: [],
        coachTeamIds: [],
        status: "active",
        teamIds: [],
        snapshot: {
          displayName,
          email,
          ...(avatarUrl ? { avatarUrl } : {}),
        },
        playerInfo: { license: "" },
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
        ...profilePatch,
        ...(linkedMemberId
          ? { activeInvitationId: admin.firestore.FieldValue.delete() }
          : {}),
      });
    }

    // Fiche déjà à l'uid, liée ici : elle entre dans l'index des admins si
    // elle porte le droit Administrateur (le re-keying gère son propre cas).
    if (!rekeyState && memberSnap.exists && clubSnap.exists) {
      const nextAdminIds = adminIdsUpdate({
        adminIds: stringArray(clubSnap.data()?.adminIds),
        memberId: uid,
        linked: true,
        permissions: memberSnap.data()?.permissions,
      });
      if (nextAdminIds) {
        tx.update(clubRef, {
          adminIds: nextAdminIds,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // `memberClubIds` : seul index des clubs du compte (écrit ici seulement).
    if (!stringArray(userData.memberClubIds).includes(clubId)) {
      tx.set(
        userRef,
        {
          memberClubIds: admin.firestore.FieldValue.arrayUnion(clubId),
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
      ...(rekeyFrom ? { memberId: uid } : {}),
    });

    return {
      memberId,
      rekeyFrom,
      email,
      sentBy: String(invite.sentBy ?? "").trim(),
      displayName,
      role: normalizeMemberInviteRole(role),
      clubName:
        String(clubSnap.data()?.name ?? invite.clubName ?? "").trim() ||
        "ton club",
      clubLogoUrl: clubLogoUrlFromData(
        (clubSnap.data() ?? {}) as Record<string, unknown>,
      ),
    };
  });

  if (result.rekeyFrom) {
    // La fiche est déjà sous l'uid : relances immédiates, puis état
    // incomplet persistant (`rekeyPendingFrom`, `rekeyFailedAt`) repris par
    // la tâche planifiée `scheduleMemberRekeyResume`.
    await rewriteMemberReferencesWithRetry({
      firestore: db(),
      clubId,
      from: result.rekeyFrom,
      uid,
    });
  }

  if (result.email) {
    await deleteOrphanPendingMembers({ clubId, email: result.email });
  }

  if (result.sentBy) {
    const inviterEmail = await resolveAuthEmail(result.sentBy);
    if (inviterEmail) {
      await trySendGuyTransactionalEmail({
        toEmail: inviterEmail,
        email: buildGuyEmail({
          kind: "inviteAcceptedMember",
          clubId,
          clubName: result.clubName,
          clubLogoUrl: result.clubLogoUrl,
          memberDisplayName: result.displayName,
          role: result.role,
        }),
        context: `invite-accepted-member ${clubId}`,
      });
    }
  }

  await captureClubEvent({
    clubId,
    event: ServerAnalyticsEvents.invitationAccepted,
    properties: {
      kind: "member",
      role: result.role,
      member_count: await clubMemberCount(clubId),
    },
  });

  return { ok: true, memberId: result.memberId };
}

/**
 * Prod → v2-prod ; `acceptInvitationDev` → v2-dev.
 */
export const {
  prod: acceptInvitation,
  dev: acceptInvitationDev,
} = defineDualCallable(
  {
    secrets: [...brevoCallableSecrets],
    timeoutSeconds: 120,
  },
  handleAcceptInvitation,
);
