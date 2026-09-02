/** Contournement Auth en dev local (évite auth/too-many-requests Firebase). */
export function isDevAuthBypassEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== "true") {
    return false;
  }

  // Sans base explicite, on ne suppose jamais « dev » : bypass désactivé.
  const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim();
  if (!databaseId) return false;
  return databaseId !== "v2-prod";
}
