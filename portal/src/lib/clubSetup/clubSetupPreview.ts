import { isDevAuthBypassEnabled } from "@/lib/firebase/devAuth";

/**
 * Aperçu UI du wizard sans compte — actif uniquement en dev local
 * (`NEXT_PUBLIC_DEV_AUTH_BYPASS=true`, base `v2-dev`).
 */
export function isClubSetupPreviewEnabled(): boolean {
  return isDevAuthBypassEnabled();
}
