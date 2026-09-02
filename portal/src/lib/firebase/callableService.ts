import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirestoreDatabaseId } from "./app";

const FUNCTIONS_REGION = "europe-west1";

function functionsClient() {
  return getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
}

/**
 * Nom de callable selon la base Firestore du portail.
 * `v2-prod` → `name` ; sinon → `nameDev`.
 */
function cloudCallableName(name: string): string {
  return getFirestoreDatabaseId() === "v2-prod" ? name : `${name}Dev`;
}

function unwrapCallableError(error: unknown): Error {
  if (error instanceof FirebaseError) {
    const message = error.message
      .replace(/^Firebase:\s*/i, "")
      .replace(/\s*\([^)]*\)\.?$/, "")
      .trim();
    return new Error(message || "Action impossible.");
  }
  if (error instanceof Error) return error;
  return new Error("Action impossible.");
}

async function callFunction<TReq, TRes>(
  name: string,
  payload: TReq,
): Promise<TRes> {
  try {
    const callable = httpsCallable<TReq, TRes>(
      functionsClient(),
      cloudCallableName(name),
    );
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    throw unwrapCallableError(error);
  }
}

/** Rôle club accepté par `setMemberRole`. */
export type CallableMemberRole = "player" | "coach" | "admin";

/**
 * Change le rôle d’un membre (admin du club uniquement).
 * Le serveur synchronise `club.adminIds` et `users/{uid}.clubMemberships`
 * et refuse de rétrograder le dernier admin.
 */
export async function setMemberRole(params: {
  clubId: string;
  memberId: string;
  role: CallableMemberRole;
}): Promise<{ ok: boolean }> {
  return callFunction("setMemberRole", params);
}

/**
 * Retire un membre du club (admin du club uniquement).
 * Le serveur nettoie `member_accounts`, `adminIds`, `memberCount`, les équipes,
 * l’invitation pending et `users/{uid}.clubMemberships`.
 */
export async function removeMember(params: {
  clubId: string;
  memberId: string;
}): Promise<{ ok: boolean }> {
  return callFunction("removeMember", params);
}

/** Invitation trouvée par `lookupInvitationByCode` (jamais l’e-mail complet). */
export type LookupInvitationPayload = {
  clubId: string;
  invitationId: string;
  code: string;
  role: string;
  type: "member" | "guardian";
  status: "pending";
  firstName: string;
  lastName: string;
  /** E-mail masqué, ex. « m•••@gmail.com ». */
  emailHint: string;
  clubName: string;
  clubSport: string;
  memberId: string | null;
  /** ISO 8601 ou null. */
  expiresAt: string | null;
};

export type LookupInvitationResult =
  | { found: false; reason?: "expired" }
  | { found: true; invitation: LookupInvitationPayload };

/**
 * Recherche une invitation pending par code (sans authentification).
 * Remplace la requête collection group côté client, interdite par les règles.
 */
export async function lookupInvitationByCode(params: {
  code: string;
}): Promise<LookupInvitationResult> {
  return callFunction("lookupInvitationByCode", params);
}

/**
 * Anonymise les fiches membre puis supprime le compte Auth de l’appelant.
 * Le client doit se réauthentifier avant, puis `signOut` après.
 */
export async function deleteMyAccount(): Promise<{
  ok: boolean;
  anonymizedMembers: number;
}> {
  return callFunction("deleteMyAccount", {});
}

/** Résultat d’un envoi d’invitation membre via Brevo. */
export type SendMemberInvitesResult = {
  ok: true;
  sent: number;
  skipped: number;
  failed: number;
  results: Array<{
    memberId: string;
    status: "sent" | "skipped" | "failed";
    reason?: string;
    messageId?: string;
  }>;
};

/**
 * Envoie les e-mails d’invitation membre via Brevo (admin club).
 * Chaque destinataire reçoit son code pending individuel.
 */
export async function sendMemberInvites(params: {
  clubId: string;
  memberIds: string[];
}): Promise<SendMemberInvitesResult> {
  return callFunction("sendMemberInvites", params);
}

/** Invite un parent sur une fiche joueur (admin ou titulaire). */
export async function inviteGuardian(params: {
  clubId: string;
  memberId: string;
  email: string;
}): Promise<{
  ok: boolean;
  invitationId: string;
  code: string;
  expiresAt: string;
  accountExists: boolean;
}> {
  return callFunction("inviteGuardian", params);
}

/** Active le lien parent pour l’adulte connecté. */
export async function linkGuardian(params?: {
  clubId?: string;
  invitationId?: string;
}): Promise<{ ok: boolean; clubId: string; memberId: string }> {
  return callFunction("linkGuardian", params ?? {});
}

/** Révoque le lien parent (admin ou titulaire). */
export async function revokeGuardian(params: {
  clubId: string;
  memberId: string;
  parentUid?: string;
}): Promise<{ ok: boolean }> {
  return callFunction("revokeGuardian", params);
}

/** Change l’e-mail d’une invitation parent pending. */
export async function updateGuardianInviteEmail(params: {
  clubId: string;
  memberId: string;
  email: string;
  invitationId?: string;
}): Promise<{ ok: boolean; invitationId: string; email: string }> {
  return callFunction("updateGuardianInviteEmail", params);
}

/** Prolonge l’expiration d’une invitation parent pending. */
export async function extendGuardianInvite(params: {
  clubId: string;
  memberId: string;
  invitationId?: string;
}): Promise<{
  ok: boolean;
  invitationId: string;
  code: string;
  expiresAt: string;
}> {
  return callFunction("extendGuardianInvite", params);
}

/** Régénère le code d’une invitation parent pending. */
export async function regenerateGuardianInvite(params: {
  clubId: string;
  memberId: string;
  invitationId?: string;
}): Promise<{
  ok: boolean;
  invitationId: string;
  code: string;
  expiresAt: string;
}> {
  return callFunction("regenerateGuardianInvite", params);
}

/** RSVP pour soi ou un enfant lié. */
export async function setEventRsvp(params: {
  clubId: string;
  eventId: string;
  memberId: string;
  value: "yes" | "maybe" | "no";
}): Promise<{ ok: boolean }> {
  return callFunction("setEventRsvp", params);
}

/** Checkout HelloAsso pour sa fiche ou un enfant lié. */
export async function createHelloAssoCheckout(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  amountCents: number;
  installmentCount?: number;
  returnUrl: string;
  backUrl?: string;
  errorUrl?: string;
}): Promise<{ redirectUrl?: string; checkoutUrl?: string }> {
  return callFunction("createHelloAssoCheckout", params);
}
