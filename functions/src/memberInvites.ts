import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { escapeHtml, sendBrevoTransactionalEmail } from "./brevo";
import { db, defineDualCallable } from "./db";
import { assertClubAdmin } from "./guardians";

const brevoApiKey = defineSecret("BREVO_API_KEY");
const brevoSenderEmail = defineString("BREVO_SENDER_EMAIL", {
  default: "noreply@viroteam.com",
});
const brevoSenderName = defineString("BREVO_SENDER_NAME", {
  default: "ViroTeam",
});
const inviteJoinBaseUrl = defineString("INVITE_JOIN_BASE_URL", {
  default: "https://www.viroteam.com",
});
const playStoreUrl = defineString("PLAY_STORE_URL", {
  default:
    "https://play.google.com/store/apps/details?id=com.viroteam.viro_team",
});

const MAX_MEMBER_IDS = 100;
const INVITATION_STATUS_PENDING = "pending";

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

function buildJoinUrl(code: string): string {
  const base = inviteJoinBaseUrl.value().replace(/\/$/, "");
  return `${base}/join?code=${encodeURIComponent(code.trim().toUpperCase())}`;
}

function buildInviteText(params: {
  clubName: string;
  firstName: string;
  code: string;
  joinUrl: string;
}): string {
  const storeLine = playStoreUrl.value()
    ? `\nApp Android : ${playStoreUrl.value()}`
    : "";
  const greeting = params.firstName
    ? `Bonjour ${params.firstName},\n\n`
    : "Bonjour,\n\n";
  return `${greeting}Rejoins ${params.clubName} sur ViroTeam !
Ton code : ${params.code}
Valable 7 jours.
Lien : ${params.joinUrl}${storeLine}
Ou ouvre l'app → « J'ai un code d'invitation » et saisis ce code.

— L'équipe ViroTeam`;
}

function buildInviteHtml(params: {
  clubName: string;
  firstName: string;
  code: string;
  joinUrl: string;
}): string {
  const safeClub = escapeHtml(params.clubName);
  const safeFirst = escapeHtml(params.firstName);
  const safeCode = escapeHtml(params.code);
  const safeUrl = escapeHtml(params.joinUrl);
  const greeting = params.firstName
    ? `Bonjour ${safeFirst},`
    : "Bonjour,";
  const storeBlock = playStoreUrl.value()
    ? `<p style="margin:16px 0 0;font-size:14px;color:#555;">App Android : <a href="${escapeHtml(playStoreUrl.value())}">télécharger</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;">
    <tr><td>
      <p style="margin:0 0 12px;font-size:16px;">${greeting}</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
        Rejoins <strong>${safeClub}</strong> sur ViroTeam.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#555;">Ton code d'invitation</p>
      <p style="margin:0 0 20px;font-size:28px;letter-spacing:0.12em;font-weight:700;">${safeCode}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#555;">Valable 7 jours.</p>
      <p style="margin:20px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">
          Ouvrir l'invitation
        </a>
      </p>
      <p style="margin:0;font-size:13px;color:#666;line-height:1.45;">
        Ou ouvre l'app → « J'ai un code d'invitation » et saisis ce code.
      </p>
      ${storeBlock}
      <p style="margin:24px 0 0;font-size:13px;color:#888;">— L'équipe ViroTeam</p>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Envoie les e-mails d’invitation membre via Brevo (admin club uniquement).
 * Chaque membre reçoit son code pending individuel.
 * Prod → v2-prod ; `sendMemberInvitesDev` → v2-dev.
 */
export const {
  prod: sendMemberInvites,
  dev: sendMemberInvitesDev,
} = defineDualCallable(
  {
    secrets: [brevoApiKey],
    timeoutSeconds: 120,
  },
  async (request: CallableRequest): Promise<SendMemberInvitesResponse> => {
    const callerUid = requireUid(request);
    const clubId = requireClubId(request.data?.clubId);
    const memberIds = normalizeMemberIds(request.data?.memberIds);

    const club = await assertClubAdmin(clubId, callerUid);
    const clubName = String(club.name ?? "ton club").trim() || "ton club";
    const apiKey = brevoApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "BREVO_API_KEY non configurée",
      );
    }

    const sender = {
      name: brevoSenderName.value(),
      email: brevoSenderEmail.value(),
    };

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
        const accountUid = String(
          memberData.accountUid ?? memberData.userId ?? "",
        ).trim();
        if (accountUid) {
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
        const email = normalizeEmail(snapshot.email);
        if (!email) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "E-mail manquant",
          });
          continue;
        }

        const inviteId = String(memberData.activeInvitationId ?? "").trim();
        if (!inviteId) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "Aucune invitation active",
          });
          continue;
        }

        const inviteSnap = await db()
          .collection("clubs")
          .doc(clubId)
          .collection("invitations")
          .doc(inviteId)
          .get();

        if (!inviteSnap.exists) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "Invitation introuvable",
          });
          continue;
        }

        const inviteData = inviteSnap.data()!;
        if (String(inviteData.status ?? "") !== INVITATION_STATUS_PENDING) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "Invitation déjà traitée",
          });
          continue;
        }

        const expiresAt =
          inviteData.expiresAt instanceof admin.firestore.Timestamp
            ? inviteData.expiresAt
            : null;
        if (!inviteStillValid(expiresAt)) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "Invitation expirée",
          });
          continue;
        }

        const code = String(inviteData.code ?? "").trim().toUpperCase();
        if (!code) {
          skipped += 1;
          results.push({
            memberId,
            status: "skipped",
            reason: "Code manquant",
          });
          continue;
        }

        const firstName = String(
          memberData.firstName ?? inviteData.firstName ?? "",
        ).trim();
        const lastName = String(
          memberData.lastName ?? inviteData.lastName ?? "",
        ).trim();
        const displayName =
          [firstName, lastName].filter(Boolean).join(" ") || undefined;
        const joinUrl = buildJoinUrl(code);
        const textContent = buildInviteText({
          clubName,
          firstName,
          code,
          joinUrl,
        });
        const htmlContent = buildInviteHtml({
          clubName,
          firstName,
          code,
          joinUrl,
        });

        const brevoResult = await sendBrevoTransactionalEmail({
          apiKey,
          sender,
          toEmail: email,
          toName: displayName,
          subject: `Invitation ${clubName} — ViroTeam`,
          textContent,
          htmlContent,
          tags: ["member-invite", clubId],
        });

        await inviteSnap.ref.update({
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

    return { ok: true, sent, skipped, failed, results };
  },
);
