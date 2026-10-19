/**
 * Migration d’audience événement : remplace un id legacy (memberId pré-créé)
 * par l’uid Auth canonique dans `teamMemberIds` et `rsvp` (testable sans Firestore).
 */

/** Remplace `legacyId` par `canonicalId` dans la liste (dédupliquée). */
export function migrateTeamMemberIds(
  teamMemberIds: string[],
  legacyId: string,
  canonicalId: string,
): string[] | null {
  if (!legacyId || !canonicalId || legacyId === canonicalId) return null;
  if (!teamMemberIds.includes(legacyId)) return null;

  const next = [
    ...new Set(
      teamMemberIds.map((id) => (id === legacyId ? canonicalId : id)),
    ),
  ];
  if (
    next.length === teamMemberIds.length &&
    next.every((id, index) => id === teamMemberIds[index])
  ) {
    return null;
  }
  return next;
}

/** Résultat pur de migration RSVP (sans FieldValue). */
export type RsvpMigrationPlan = {
  /** Supprimer la clé legacy. */
  deleteLegacy: boolean;
  /** Écrire la valeur legacy sous la clé canonique. */
  setCanonical: boolean;
  legacyValue: unknown;
};

/** Calcule comment migrer la map RSVP (pur). */
export function planRsvpMigration(
  rsvp: Record<string, unknown> | null | undefined,
  legacyId: string,
  canonicalId: string,
): RsvpMigrationPlan | null {
  if (!rsvp || typeof rsvp !== "object") return null;
  if (!legacyId || !canonicalId || legacyId === canonicalId) return null;
  if (!(legacyId in rsvp)) return null;

  const legacyValue = rsvp[legacyId];
  const canonicalRaw = rsvp[canonicalId];
  const hasCanonical =
    canonicalRaw !== undefined &&
    canonicalRaw !== null &&
    String(canonicalRaw).trim() !== "";

  return {
    deleteLegacy: true,
    setCanonical: !hasCanonical && legacyValue !== undefined && legacyValue !== null,
    legacyValue,
  };
}

/**
 * Patch Firestore pour un document event (ids + RSVP).
 * Retourne `null` si rien à changer.
 */
export function buildEventAudienceMigrationPatch(params: {
  teamMemberIds: string[];
  rsvp: Record<string, unknown> | null | undefined;
  legacyId: string;
  canonicalId: string;
  deleteField: unknown;
}): Record<string, unknown> | null {
  const { teamMemberIds, rsvp, legacyId, canonicalId, deleteField } = params;
  const nextMembers = migrateTeamMemberIds(teamMemberIds, legacyId, canonicalId);
  const rsvpPlan = planRsvpMigration(rsvp, legacyId, canonicalId);
  if (!nextMembers && !rsvpPlan) return null;

  const patch: Record<string, unknown> = {};
  if (nextMembers) {
    patch.teamMemberIds = nextMembers;
  }
  if (rsvpPlan) {
    patch[`rsvp.${legacyId}`] = deleteField;
    if (rsvpPlan.setCanonical) {
      patch[`rsvp.${canonicalId}`] = rsvpPlan.legacyValue;
    }
  }
  return patch;
}
