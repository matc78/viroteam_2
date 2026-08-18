import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./app";

const FUNCTIONS_REGION = "europe-west1";

function functionsClient() {
  return getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
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
    const callable = httpsCallable<TReq, TRes>(functionsClient(), name);
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    throw unwrapCallableError(error);
  }
}

/** Invite un parent sur une fiche joueur (admin). */
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

/** Révoque le lien parent (admin). */
export async function revokeGuardian(params: {
  clubId: string;
  memberId: string;
  parentUid?: string;
}): Promise<{ ok: boolean }> {
  return callFunction("revokeGuardian", params);
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
