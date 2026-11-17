/**
 * Ajoute ou retire `uid` de la liste de l’emoji dans une map de réactions
 * (`emoji` → uids). Liste vidée → clé supprimée. Ne modifie pas l’entrée.
 * Même règle côté écriture Firestore (`toggleReaction`) et côté affichage
 * optimiste.
 */
export function toggleReactionUid(
  reactions: Record<string, string[]>,
  emoji: string,
  uid: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...reactions };
  const current = next[emoji] ?? [];
  if (current.includes(uid)) {
    const remaining = current.filter((id) => id !== uid);
    if (remaining.length === 0) delete next[emoji];
    else next[emoji] = remaining;
  } else {
    next[emoji] = [...current, uid];
  }
  return next;
}
