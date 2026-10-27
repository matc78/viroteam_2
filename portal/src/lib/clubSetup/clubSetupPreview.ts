/**
 * Aperçu UI du wizard sans compte — actif uniquement en dev local
 * (`NEXT_PUBLIC_CLUB_SETUP_PREVIEW=true`), jamais sur la base `v2-prod`.
 */
export function isClubSetupPreviewEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_CLUB_SETUP_PREVIEW !== "true") return false;
  // Sans base explicite, on ne suppose jamais « dev » : aperçu désactivé.
  const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim();
  return Boolean(databaseId) && databaseId !== "v2-prod";
}
