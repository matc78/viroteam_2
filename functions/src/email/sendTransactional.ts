/**
 * Envoi transactionnel Brevo + params Firebase partagés.
 */
import * as admin from "firebase-admin";
import { defineSecret, defineString } from "firebase-functions/params";
import { sendBrevoTransactionalEmail } from "../brevo";
import { buildGuyEmail } from "./guyCopy";
import type { BuiltEmail, GuyEmailParams } from "./types";

export const brevoApiKey = defineSecret("BREVO_API_KEY");
export const brevoSenderEmail = defineString("BREVO_SENDER_EMAIL", {
  default: "noreply@viroteam.com",
});
export const brevoSenderName = defineString("BREVO_SENDER_NAME", {
  default: "Guy · ViroTeam",
});
export const inviteJoinBaseUrl = defineString("INVITE_JOIN_BASE_URL", {
  default: "https://www.viroteam.com",
});
export const playStoreUrl = defineString("PLAY_STORE_URL", {
  default:
    "https://play.google.com/store/apps/details?id=com.viroteam.viro_team",
});

/** Options callables qui envoient via Brevo. */
export const brevoCallableSecrets = [brevoApiKey] as const;

/**
 * URL de join web avec code d’invitation.
 */
export function buildJoinUrl(code: string): string {
  const base = inviteJoinBaseUrl.value().replace(/\/$/, "");
  return `${base}/join?code=${encodeURIComponent(code.trim().toUpperCase())}`;
}

/**
 * Play Store URL paramétrée (chaîne vide si désactivée).
 */
export function configuredPlayStoreUrl(): string | undefined {
  const value = playStoreUrl.value().trim();
  return value || undefined;
}

/**
 * Extrait `logoUrl` club si présent.
 */
export function clubLogoUrlFromData(
  club: Record<string, unknown> | undefined | null,
): string | undefined {
  if (!club) return undefined;
  const url = String(club.logoUrl ?? "").trim();
  return url || undefined;
}

/**
 * E-mail Auth d’un uid, ou null si introuvable.
 */
export async function resolveAuthEmail(uid: string): Promise<string | null> {
  const trimmed = uid.trim();
  if (!trimmed) return null;
  try {
    const user = await admin.auth().getUser(trimmed);
    const email = user.email?.trim().toLowerCase();
    return email && email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

/**
 * Envoie un mail Guy via Brevo. Lève en cas d’échec API.
 */
export async function sendGuyTransactionalEmail(params: {
  toEmail: string;
  toName?: string;
  email: BuiltEmail | GuyEmailParams;
}): Promise<{ messageId: string }> {
  const apiKey = brevoApiKey.value();
  if (!apiKey) {
    throw new Error("BREVO_API_KEY non configurée");
  }
  const built =
    "subject" in params.email && "htmlContent" in params.email
      ? (params.email as BuiltEmail)
      : buildGuyEmail(params.email as GuyEmailParams);

  return sendBrevoTransactionalEmail({
    apiKey,
    sender: {
      name: brevoSenderName.value(),
      email: brevoSenderEmail.value(),
    },
    toEmail: params.toEmail,
    toName: params.toName,
    subject: built.subject,
    textContent: built.textContent,
    htmlContent: built.htmlContent,
    tags: built.tags,
  });
}

/**
 * Envoi soft-fail : log l’erreur et renvoie null (ne casse pas le flux métier).
 */
export async function trySendGuyTransactionalEmail(params: {
  toEmail: string;
  toName?: string;
  email: BuiltEmail | GuyEmailParams;
  context?: string;
}): Promise<{ messageId: string } | null> {
  try {
    return await sendGuyTransactionalEmail(params);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[brevo] échec envoi${params.context ? ` (${params.context})` : ""}: ${message}`,
    );
    return null;
  }
}
