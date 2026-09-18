import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import {
  buildGuyEmail,
  buildJoinUrl,
  clubLogoUrlFromData,
  configuredPlayStoreUrl,
  brevoApiKey,
  brevoCallableSecrets,
  normalizeMemberInviteRole,
  sendGuyTransactionalEmail,
} from "./email";
import { db, defineDualCallable } from "./db";
import { assertClubAdmin } from "./guardians";
import { ClubActivityTypes, logClubActivity } from "./clubActivity";

const MAX_MEMBER_IDS = 100;
const INVITE_TTL_DAYS = 7;
const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_EXPIRED = "expired";
const INVITATION_TYPE_MEMBER = "member";

function generateInviteCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

type InviteSendItemResult = {
  memberId: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  messageId?: string;
};

type SendMemberInvitesResponse = {
  ok: true;
  sent: number;
  skipped: number;
  failed: number;
  results: InviteSendItemResult[];
};

function requireUid(request: { auth?: { uid: string } }): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  return request.auth.uid;
}

function requireClubId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", "clubId requis");
  }
  return value.trim();
}

function normalizeMemberIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", "memberIds requis");
  }
  const ids = [
    ...new Set(
      raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
  if (ids.length === 0) {
    throw new HttpsError("invalid-argument", "memberIds requis");
  }
  if (ids.length > MAX_MEMBER_IDS) {
    throw new HttpsError(
      "invalid-argument",
      `Maximum ${MAX_MEMBER_IDS} membres par envoi`,
    );
  }
  return ids;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

function inviteStillValid(expiresAt: admin.firestore.Timestamp | Date | null): boolean {
  if (!expiresAt) return false;
  const date =
    expiresAt instanceof admin.firestore.Timestamp
      ? expiresAt.toDate()
      : expiresAt;
  return date.getTime() > Date.now();
}

type EnsuredInvite = {
  code: string;
  inviteRef: admin.firestore.DocumentReference;
};

/**
 * Réutilise une invitation pending encore valide, sinon en crée une nouvelle
 * (et expire l’ancienne pending si présente).
 */
async function ensurePendingInvite(params: {
  clubId: string;
  memberId: string;
  memberData: admin.firestore.DocumentData;
  email: string;
  clubName: string;
  clubSport: string;
  callerUid: string;
}): Promise<EnsuredInvite> {
  const {
    clubId,
    memberId,
    memberData,
    email,
    clubName,
    clubSport,
    callerUid,
  } = params;

  const memberRef = db()
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(memberId);
  const invitationsCol = db()
    .collection("clubs")
    .doc(clubId)
    .collection("invitations");

  const inviteId = String(memberData.activeInvitationId ?? "").trim();
  if (inviteId) {
    const inviteSnap = await invitationsCol.doc(inviteId).get();
    if (inviteSnap.exists) {
      const inviteData = inviteSnap.data()!;
      const status = String(inviteData.status ?? "");
      const expiresAt =
        inviteData.expiresAt instanceof admin.firestore.Timestamp
          ? inviteData.expiresAt
          : null;
      const code = String(inviteData.code ?? "").trim().toUpperCase();
      if (
        status === INVITATION_STATUS_PENDING &&
        inviteStillValid(expiresAt) &&
        code
      ) {
        // Prolonge la validité à chaque renvoi (réutilisation du même code).
        const refreshedExpiresAt = new Date();
        refreshedExpiresAt.setDate(
          refreshedExpiresAt.getDate() + INVITE_TTL_DAYS,
        );
        await inviteSnap.ref.update({
          expiresAt: admin.firestore.Timestamp.fromDate(refreshedExpiresAt),
          email,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { code, inviteRef: inviteSnap.ref };
      }
    }
  }

  const role = String(memberData.role ?? "player").trim() || "player";
  const firstName = String(memberData.firstName ?? "").trim();
  const lastName = String(memberData.lastName ?? "").trim();
  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  const newInviteRef = invitationsCol.doc();

  await db().runTransaction(async (tx) => {
    const freshMemberSnap = await tx.get(memberRef);
    if (!freshMemberSnap.exists) {
      throw new Error("Membre introuvable");
    }
    const freshData = freshMemberSnap.data()!;
    const previousInviteId = String(freshData.activeInvitationId ?? "").trim();
    if (previousInviteId) {
      const previousInviteRef = invitationsCol.doc(previousInviteId);
      const previousInviteSnap = await tx.get(previousInviteRef);
      if (
        previousInviteSnap.exists &&
        String(previousInviteSnap.data()?.status ?? "") ===
          INVITATION_STATUS_PENDING
      ) {
        tx.update(previousInviteRef, {
          status: INVITATION_STATUS_EXPIRED,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    tx.set(newInviteRef, {
      code,
      type: INVITATION_TYPE_MEMBER,
      role,
      status: INVITATION_STATUS_PENDING,
      email,
      memberId,
      sentBy: callerUid,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      clubName,
      clubSport,
      firstName,
      lastName,
    });
    tx.update(memberRef, {
      activeInvitationId: newInviteRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { code, inviteRef: newInviteRef };
}

/**
 * Envoie les e-mails d’invitation membre via Brevo (admin club uniquement).
 * Chaque membre reçoit son code pending individuel (voix Guy).
 * Prod → v2-prod ; `sendMemberInvitesDev` → v2-dev.
 */
export const {
  prod: sendMemberInvites,
  dev: sendMemberInvitesDev,
} = defineDualCallable(
  {
    secrets: [...brevoCallableSecrets],
    timeoutSeconds: 120,
  },
  async (request: CallableRequest): Promise<SendMemberInvitesResponse> => {
    const callerUid = requireUid(request);
    const clubId = requireClubId(request.data?.clubId);
    const memberIds = normalizeMemberIds(request.data?.memberIds);

    const club = await assertClubAdmin(clubId, callerUid);
    const clubName = String(club.name ?? "ton club").trim() || "ton club";
    const clubLogoUrl = clubLogoUrlFromData(club as Record<string, unknown>);
    const apiKey = brevoApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "BREVO_API_KEY non configurée",
      );
    }

    const results: InviteSendItemResult[] = [];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const memberId of memberIds) {
      try {
        const memberSnap = await db()
          .collection("clubs")
          .doc(clubId)
          .collection("members")
          .doc(memberId)
          .get();

        if (!memberSnap.exists) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "Membre introuvable",
          });
          continue;
        }

        const memberData = memberSnap.data()!;
        const accountUid = String(memberData.accountUid ?? "").trim();
        const legacyUserId = String(memberData.userId ?? "").trim();
        let linkedUid = accountUid;
        // Legacy `userId` : ne considérer comme lié que si le profil users existe.
        if (!linkedUid && legacyUserId) {
          const userSnap = await db().collection("users").doc(legacyUserId).get();
          if (userSnap.exists) linkedUid = legacyUserId;
        }
        if (linkedUid) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "Compte déjà lié",
          });
          continue;
        }

        const snapshot =
          memberData.snapshot && typeof memberData.snapshot === "object"
            ? (memberData.snapshot as Record<string, unknown>)
            : {};
        // E-mail : snapshot d’abord ; sinon champ membre ; sinon invitation active.
        let resolvedEmail =
          normalizeEmail(snapshot.email) ?? normalizeEmail(memberData.email);
        if (!resolvedEmail) {
          const inviteId = String(memberData.activeInvitationId ?? "").trim();
          if (inviteId) {
            const inviteSnap = await db()
              .collection("clubs")
              .doc(clubId)
              .collection("invitations")
              .doc(inviteId)
              .get();
            if (inviteSnap.exists) {
              resolvedEmail = normalizeEmail(inviteSnap.data()?.email);
            }
          }
        }
        if (!resolvedEmail) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "E-mail manquant",
          });
          continue;
        }
        const email = resolvedEmail;

        const clubSport = String(club.sport ?? "").trim();
        const ensured = await ensurePendingInvite({
          clubId,
          memberId,
          memberData,
          email,
          clubName,
          clubSport,
          callerUid,
        });

        const firstName = String(memberData.firstName ?? "").trim();
        const lastName = String(memberData.lastName ?? "").trim();
        const displayName =
          [firstName, lastName].filter(Boolean).join(" ") || undefined;
        const role = normalizeMemberInviteRole(String(memberData.role ?? "player"));
        const joinUrl = buildJoinUrl(ensured.code);
        const emailContent = buildGuyEmail({
          kind: "memberInvite",
          clubId,
          clubName,
          clubLogoUrl,
          role,
          firstName,
          code: ensured.code,
          joinUrl,
          playStoreUrl: configuredPlayStoreUrl(),
        });

        const brevoResult = await sendGuyTransactionalEmail({
          toEmail: email,
          toName: displayName,
          email: emailContent,
        });

        await ensured.inviteRef.update({
          lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          lastEmailSentBy: callerUid,
          lastEmailTo: email,
          lastEmailMessageId: brevoResult.messageId || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        sent += 1;
        results.push({
          memberId,
          status: "sent",
          messageId: brevoResult.messageId || undefined,
        });
      } catch (error: unknown) {
        failed += 1;
        results.push({
          memberId,
          status: "failed",
          reason:
            error instanceof Error ? error.message : "Échec d’envoi",
        });
      }
    }

    if (sent > 0) {
      await logClubActivity({
        clubId,
        type: ClubActivityTypes.invitationsSent,
        actorUid: callerUid,
        count: sent,
      });
    }

    return { ok: true, sent, skipped, failed, results };
  },
);
