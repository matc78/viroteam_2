import { ChatWritePolicies } from "@/lib/firebase/constants";

/** Textes de la messagerie du portail. */
export const chatCopy = {
  /** Bandeau à la place du composer quand l’utilisateur ne peut pas écrire. */
  readonlyNotice(writePolicy: string | undefined): string {
    switch (writePolicy) {
      case ChatWritePolicies.closed:
        return "Cette discussion est fermée : l’historique reste consultable.";
      case ChatWritePolicies.coachesAndAdmins:
        return "Seuls les coachs et les admins peuvent écrire ici.";
      default:
        return "Seuls les admins peuvent écrire ici.";
    }
  },
  /** Création d’un canal dont la cible a déjà un canal. */
  channelAlreadyExists: "Un canal existe déjà pour cette cible.",
} as const;
