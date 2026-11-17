/**
 * Causes d’échec d’une recherche de code d’invitation et textes associés.
 * Logique pure (testée par vitest).
 */
import type { LookupInvitationResult } from "@/lib/firebase/callableService";
import { joinCopy } from "@/lib/copy/joinCopy";

/** Pourquoi un code n’a pas abouti à une invitation. */
export type InvitationLookupFailure =
  | "notFound"
  | "expired"
  | "exhausted"
  /** Réseau, service indisponible, réponse inattendue. */
  | "error";

/** Cause d’échec d’une réponse `lookupInvitationByCode` non trouvée. */
export function lookupFailureFromResult(
  result: Extract<LookupInvitationResult, { found: false }>,
): InvitationLookupFailure {
  if (result.reason === "expired") return "expired";
  if (result.reason === "exhausted") return "exhausted";
  return "notFound";
}

/** Titre et texte d’écran pour une cause d’échec. */
export function lookupFailureCopy(failure: InvitationLookupFailure): {
  title: string;
  lead: string;
} {
  switch (failure) {
    case "expired":
      return {
        title: joinCopy.lookupExpiredTitle,
        lead: joinCopy.lookupExpiredLead,
      };
    case "exhausted":
      return {
        title: joinCopy.lookupExhaustedTitle,
        lead: joinCopy.lookupExhaustedLead,
      };
    case "error":
      return {
        title: joinCopy.lookupErrorTitle,
        lead: joinCopy.lookupErrorLead,
      };
    default:
      return {
        title: joinCopy.lookupNotFoundTitle,
        lead: joinCopy.lookupNotFoundLead,
      };
  }
}
