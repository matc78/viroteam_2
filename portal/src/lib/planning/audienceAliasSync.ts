/**
 * Helpers purs pour aligner `teamMemberIds` / RSVP sur les ids roster
 * canoniques sans empiler memberId + accountUid.
 */

/** Paire d’alias pour une fiche membre. */
export type AudienceAliasPair = {
  memberId: string;
  /** accountUid si lié, sinon memberId. */
  canonicalId: string;
};

/** Index anyId → canonicalId. */
export function buildCanonicalByAnyId(
  pairs: AudienceAliasPair[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of pairs) {
    if (!pair.memberId || !pair.canonicalId) continue;
    map.set(pair.memberId, pair.canonicalId);
    map.set(pair.canonicalId, pair.canonicalId);
  }
  return map;
}

export type AudienceSyncPlan = {
  /** Prochaine liste teamMemberIds (ordre non garanti). */
  nextMemberIds: string[];
  /** Clés RSVP legacy à supprimer. */
  rsvpDeletes: string[];
  /** Migrations RSVP legacy → canonique (valeur à recopier si canonique absente). */
  rsvpMoves: Array<{ from: string; to: string }>;
  changed: boolean;
};

/**
 * Ids des joueurs retirés des convoqués (`excludedMemberIds`) étendus à leur
 * alias canonique, pour comparer quel que soit l’id stocké (memberId / uid).
 */
export function excludedCanonicalIds(
  excludedMemberIds: string[] | undefined,
  canonicalByAnyId: Map<string, string>,
): Set<string> {
  const result = new Set<string>();
  for (const id of excludedMemberIds ?? []) {
    if (!id) continue;
    result.add(id);
    result.add(canonicalByAnyId.get(id) ?? id);
  }
  return result;
}

/** True si `id` (ou son alias canonique) fait partie des exclus étendus. */
export function isAudienceIdExcluded(
  id: string,
  excludedCanonical: Set<string>,
  canonicalByAnyId: Map<string, string>,
): boolean {
  if (excludedCanonical.size === 0) return false;
  return (
    excludedCanonical.has(id) ||
    excludedCanonical.has(canonicalByAnyId.get(id) ?? id)
  );
}

/**
 * Calcule la sync audience : ajoute les ids attendus (roster), retire les
 * alias legacy des membres concernés, conserve les invités manuels hors alias.
 * Un id présent dans `excludedMemberIds` (ou un de ses alias) n’est jamais
 * réintégré : le retrait des convoqués par le coach prime sur le roster.
 */
export function planAudienceSync(params: {
  currentMemberIds: string[];
  expectedCanonicalIds: string[];
  canonicalByAnyId: Map<string, string>;
  rsvpKeys?: string[];
  excludedMemberIds?: string[];
}): AudienceSyncPlan {
  const current = [...new Set(params.currentMemberIds.filter(Boolean))];
  const excluded = excludedCanonicalIds(
    params.excludedMemberIds,
    params.canonicalByAnyId,
  );
  const expected = new Set(
    params.expectedCanonicalIds.filter(
      (id) =>
        Boolean(id) &&
        !isAudienceIdExcluded(id, excluded, params.canonicalByAnyId),
    ),
  );
  const next = new Set(current);
  const rsvpDeletes: string[] = [];
  const rsvpMoves: Array<{ from: string; to: string }> = [];

  for (const id of current) {
    const canonical = params.canonicalByAnyId.get(id) ?? id;
    if (id === canonical) continue;
    // Alias non canonique d’un membre attendu ou déjà présent sous l’uid Auth.
    if (expected.has(canonical) || current.includes(canonical) || expected.has(id)) {
      next.delete(id);
      rsvpDeletes.push(id);
      rsvpMoves.push({ from: id, to: canonical });
    }
  }

  for (const id of expected) {
    next.add(id);
  }

  // RSVP orphelins sur un legacy alors que le canonique est dans next.
  for (const key of params.rsvpKeys ?? []) {
    const canonical = params.canonicalByAnyId.get(key) ?? key;
    if (key !== canonical && next.has(canonical) && !rsvpDeletes.includes(key)) {
      rsvpDeletes.push(key);
      rsvpMoves.push({ from: key, to: canonical });
    }
  }

  const nextMemberIds = [...next];
  const sameSize = nextMemberIds.length === current.length;
  const sameIds =
    sameSize && nextMemberIds.every((id) => current.includes(id));
  const changed = !sameIds || rsvpDeletes.length > 0;

  return { nextMemberIds, rsvpDeletes, rsvpMoves, changed };
}

/** Maps d’un event indexées par id d’audience. */
export type AudienceKeyedMaps = {
  rsvp: Record<string, unknown>;
  rsvpUpdatedAt: Record<string, unknown>;
  seenAt: Record<string, unknown>;
};

/** Toutes les clés d’audience présentes dans les maps (entrée `rsvpKeys`). */
export function audienceMapKeys(maps: AudienceKeyedMaps): string[] {
  return [
    ...new Set([
      ...Object.keys(maps.rsvp),
      ...Object.keys(maps.rsvpUpdatedAt),
      ...Object.keys(maps.seenAt),
    ]),
  ];
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * Patch des maps RSVP / `rsvpUpdatedAt` / `seenAt` pour les clés legacy du plan.
 * Le timestamp de vote suit le RSVP (déplacé seulement avec lui) ; `seenAt`
 * migre seul et conserve la vue canonique existante.
 */
export function buildAudienceMapsPatch(params: {
  plan: Pick<AudienceSyncPlan, "rsvpDeletes" | "rsvpMoves">;
  maps: AudienceKeyedMaps;
  deleteField: unknown;
}): Record<string, unknown> {
  const { plan, maps, deleteField } = params;
  const patch: Record<string, unknown> = {};
  for (const legacyKey of plan.rsvpDeletes) {
    const target = plan.rsvpMoves.find((entry) => entry.from === legacyKey)?.to;
    let rsvpMoved = false;
    if (legacyKey in maps.rsvp) {
      const legacyValue = maps.rsvp[legacyKey];
      if (target && !hasValue(maps.rsvp[target]) && legacyValue != null) {
        patch[`rsvp.${target}`] = legacyValue;
        rsvpMoved = true;
      }
      patch[`rsvp.${legacyKey}`] = deleteField;
    }
    if (legacyKey in maps.rsvpUpdatedAt) {
      const legacyValue = maps.rsvpUpdatedAt[legacyKey];
      if (target && rsvpMoved && legacyValue != null) {
        patch[`rsvpUpdatedAt.${target}`] = legacyValue;
      }
      patch[`rsvpUpdatedAt.${legacyKey}`] = deleteField;
    }
    if (legacyKey in maps.seenAt) {
      const legacyValue = maps.seenAt[legacyKey];
      if (target && maps.seenAt[target] == null && legacyValue != null) {
        patch[`seenAt.${target}`] = legacyValue;
      }
      patch[`seenAt.${legacyKey}`] = deleteField;
    }
  }
  return patch;
}
