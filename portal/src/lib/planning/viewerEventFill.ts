/**
 * Remplissage d’un bloc agenda selon le RSVP du viewer :
 * `filled` (oui), `maybe` (peut-être), `declined` (non), `outline` (sans
 * réponse) ou `default` (viewer non convoqué / pas d’ids).
 */
export type ViewerEventFill =
  | "filled"
  | "maybe"
  | "declined"
  | "outline"
  | "default";

/**
 * Détermine le rendu du bloc pour le viewer.
 *
 * Audience vide = ouvert à tous (aligné FamilyRsvpButtons).
 * Le premier id du viewer portant une réponse fait foi ; aucune → `outline`.
 */
export function resolveViewerEventFill(params: {
  teamMemberIds: string[];
  rsvpByMemberId: Record<string, string>;
  /**
   * Ids de fiche pour lesquels le viewer répond (lui-même = son uid, ses
   * enfants en planning perso).
   */
  viewerMemberIds: string[];
}): ViewerEventFill {
  const memberIds = params.viewerMemberIds.map(String).filter(Boolean);
  if (memberIds.length === 0) return "default";

  const audience = new Set(params.teamMemberIds.map(String).filter(Boolean));
  const isInvited =
    audience.size === 0 || memberIds.some((id) => audience.has(id));
  if (!isInvited) return "default";

  for (const id of memberIds) {
    const value = (params.rsvpByMemberId[id] ?? "").toLowerCase();
    if (value === "yes") return "filled";
    if (value === "maybe") return "maybe";
    if (value === "no") return "declined";
  }
  return "outline";
}

/**
 * Valeur `data-rsvp-fill` pour le DOM : omise si `default` (style legacy).
 */
export function viewerEventFillAttr(
  fill: ViewerEventFill,
): Exclude<ViewerEventFill, "default"> | undefined {
  if (fill === "default") return undefined;
  return fill;
}
