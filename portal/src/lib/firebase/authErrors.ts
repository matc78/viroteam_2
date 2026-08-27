import { FirebaseError } from "firebase/app";

/** Erreur Auth avec message FR et code Firebase conservé. */
export class AuthActionError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuthActionError";
    this.code = code;
  }
}

function errorCode(error: unknown): string | undefined {
  if (error instanceof AuthActionError) return error.code;
  if (error instanceof FirebaseError) return error.code;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function errorMessageHint(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message.trim()
      ? message.trim()
      : undefined;
  }
  return undefined;
}

/** Message FR pour un code Auth Firebase. */
function messageForAuthCode(code: string): string | null {
  switch (code) {
    case "auth/invalid-email":
      return "Adresse e-mail invalide.";
    case "auth/user-disabled":
      return "Ce compte est désactivé.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-mail ou mot de passe incorrect.";
    case "auth/email-already-in-use":
      return "Un compte existe déjà avec cet e-mail.";
    case "auth/weak-password":
      return "Mot de passe trop faible (8 caractères minimum).";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessaie plus tard.";
    case "auth/network-request-failed":
      return "Problème réseau. Vérifie ta connexion.";
    case "auth/account-exists-with-different-credential":
      return "Un compte existe déjà avec cet e-mail. Connecte-toi avec ton mot de passe.";
    case "auth/popup-closed-by-user":
      return "Connexion annulée.";
    default:
      return null;
  }
}

/**
 * Indique un compte Auth introuvable (redirection access-denied).
 * Inclut `invalid-credential` (Firebase fusionne souvent compte inconnu / mauvais mdp).
 */
export function isUnknownAccountAuthError(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === "auth/user-not-found" || code === "auth/invalid-credential"
  );
}

/** Convertit une erreur Auth/Firebase en AuthActionError (message FR). */
export function toAuthActionError(error: unknown): AuthActionError {
  if (error instanceof AuthActionError) return error;
  const code = errorCode(error);
  if (code) {
    return new AuthActionError(
      messageForAuthCode(code) ??
        errorMessageHint(error) ??
        "Une erreur est survenue.",
      code,
    );
  }
  return new AuthActionError(
    errorMessageHint(error) ?? "Une erreur est survenue.",
  );
}

/** Messages d’erreur Auth Firebase en français. */
export function authErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code) {
    return (
      messageForAuthCode(code) ??
      errorMessageHint(error) ??
      "Une erreur est survenue."
    );
  }
  return errorMessageHint(error) ?? "Une erreur est survenue.";
}
