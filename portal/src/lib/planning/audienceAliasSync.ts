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
 * Calcule la sync audience : ajoute les ids attendus (roster), retire les
 * alias legacy des membres concernés, conserve les invités manuels hors alias.
 */
export function planAudienceSync(params: {
  currentMemberIds: string[];
  expectedCanonicalIds: string[];
  canonicalByAnyId: Map<string, string>;
  rsvpKeys?: string[];
}): AudienceSyncPlan {
  const current = [...new Set(params.currentMemberIds.filter(Boolean))];
  const expected = new Set(params.expectedCanonicalIds.filter(Boolean));
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
