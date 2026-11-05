/**
 * Helpers purs de la propagation profil `users/{uid}` → fiche membre
 * (testables avec `node --test`).
 */

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Patch (dot-paths) à appliquer à la fiche [member] pour refléter le profil
 * [user] : `firstName`, `lastName`, `snapshot.displayName`,
 * `snapshot.avatarUrl`. Un profil sans nom ni photo ne vide jamais la fiche.
 * Retourne `null` si la fiche est déjà à jour.
 */
export function memberProfileSyncPatch(
  user: Record<string, unknown>,
  member: Record<string, unknown>,
): Record<string, string> | null {
  const firstName = text(user.firstName);
  const lastName = text(user.lastName);
  const displayName =
    text(user.displayName) || [firstName, lastName].filter(Boolean).join(" ");
  const avatarUrl = text(user.avatarUrl);
  const snapshot =
    member.snapshot && typeof member.snapshot === "object"
      ? (member.snapshot as Record<string, unknown>)
      : {};

  const patch: Record<string, string> = {};
  if (firstName || lastName) {
    if (text(member.firstName) !== firstName) patch.firstName = firstName;
    if (text(member.lastName) !== lastName) patch.lastName = lastName;
  }
  if (displayName && text(snapshot.displayName) !== displayName) {
    patch["snapshot.displayName"] = displayName;
  }
  if (avatarUrl && text(snapshot.avatarUrl) !== avatarUrl) {
    patch["snapshot.avatarUrl"] = avatarUrl;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
