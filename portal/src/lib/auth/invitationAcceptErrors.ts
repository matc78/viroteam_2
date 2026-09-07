/** True si le message serveur indique une invitation déjà acceptée / traitée. */
export function isInvitationAlreadyProcessed(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("déjà trait") ||
    normalized.includes("deja trait") ||
    normalized.includes("déjà activ") ||
    normalized.includes("deja activ") ||
    normalized.includes("invitation déjà") ||
    normalized.includes("invitation deja") ||
    normalized.includes("lien déjà") ||
    normalized.includes("lien deja")
  );
}
