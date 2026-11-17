/**
 * Libellés des badges (Admin, Entraîneur, Joueur, Membre, Parent) : seul
 * endroit du portail. Mêmes textes que l’app (`lib/copy/app_copy_common.dart`).
 */
import type { DisplayBadge } from "@/lib/auth/permissions";

const badgeLabels: Record<DisplayBadge, string> = {
  admin: "Admin",
  coach: "Entraîneur",
  player: "Joueur",
  member: "Membre",
  parent: "Parent",
};

/** Libellé d’un badge affichable. */
export function badgeLabel(badge: DisplayBadge): string {
  return badgeLabels[badge];
}
