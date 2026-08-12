/** Contournement Auth en dev local (évite auth/too-many-requests Firebase). */
export function isDevAuthBypassEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== "true") {
    return false;
  }

  const databaseId =
    process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || "v2-dev";
  return databaseId !== "v2-prod";
}
