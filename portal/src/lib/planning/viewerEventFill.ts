/** Remplissage d’un bloc agenda selon le RSVP du viewer. */
export type ViewerEventFill = "filled" | "outline" | "default";

/**
 * Détermine si le bloc doit être plein (présent), outline (absent / sans
 * réponse), ou inchangé (viewer non convoqué / pas d’ids).
 *
 * Audience vide = ouvert à tous (aligné FamilyRsvpButtons).
 * Seul `yes` remplit le bloc ; `no`, `maybe` et clé absente → outline.
 */
export function resolveViewerEventFill(params: {
  teamMemberIds: string[];
  rsvpByMemberId: Record<string, string>;
  viewerMatchIds: string[];
}): ViewerEventFill {
  const matchIds = params.viewerMatchIds.map(String).filter(Boolean);
  if (matchIds.length === 0) return "default";

  const matchSet = new Set(matchIds);
  const audience = params.teamMemberIds.map(String).filter(Boolean);
  const isInvited =
    audience.length === 0 || audience.some((id) => matchSet.has(id));
  if (!isInvited) return "default";

  for (const id of matchIds) {
    const value = (params.rsvpByMemberId[id] ?? "").toLowerCase();
    if (value === "yes") return "filled";
    if (value === "no" || value === "maybe") return "outline";
  }
  return "outline";
}

/**
 * Valeur `data-rsvp-fill` pour le DOM : omise si `default` (style legacy).
 */
export function viewerEventFillAttr(
  fill: ViewerEventFill,
): "filled" | "outline" | undefined {
  if (fill === "default") return undefined;
  return fill;
}
