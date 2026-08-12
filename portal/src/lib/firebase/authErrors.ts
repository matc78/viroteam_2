import { FirebaseError } from "firebase/app";

/** Messages d’erreur Auth Firebase en français. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
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
        return error.message || "Une erreur est survenue.";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Une erreur est survenue.";
}
