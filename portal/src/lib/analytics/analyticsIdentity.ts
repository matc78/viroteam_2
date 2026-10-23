import type { ClubRecord } from "@/lib/firebase/clubService";
import { MemberRoles } from "@/lib/firebase/constants";
import type { ViroUserProfile } from "@/lib/firebase/types";

/** Valeur de `max_role` pour un compte sans fiche membre (parent seul). */
export const ANALYTICS_NO_ROLE = "none";

/** Type de groupe PostHog du club actif (aligné app : `AnalyticsService.clubGroupType`). */
export const CLUB_GROUP_TYPE = "club";

const ROLE_LEVELS: Record<string, number> = {
  [MemberRoles.admin]: 3,
  [MemberRoles.coach]: 2,
  [MemberRoles.player]: 1,
};

/**
 * Propriétés « personne » PostHog, sans PII (ni nom, ni e-mail) : rôle club
 * le plus élevé, parent ou non, nombre de clubs (membre ou parent).
 * Mêmes clés que l’app (`analyticsPersonProperties`).
 */
export function analyticsPersonProperties(profile: ViroUserProfile): {
  max_role: string;
  is_parent: boolean;
  club_count: number;
} {
  let maxRole = ANALYTICS_NO_ROLE;
  for (const membership of profile.clubMemberships) {
    if ((ROLE_LEVELS[membership.role] ?? 0) > (ROLE_LEVELS[maxRole] ?? 0)) {
      maxRole = membership.role;
    }
  }
  const clubIds = new Set([
    ...profile.clubMemberships.map((membership) => membership.clubId),
    ...profile.parentClubIds,
  ]);
  return {
    max_role: maxRole,
    is_parent: profile.parentLinks.length > 0,
    club_count: clubIds.size,
  };
}

/** Propriétés du groupe PostHog `club`. */
export function analyticsClubProperties(club: ClubRecord): {
  name: string;
  sport: string;
  member_count: number;
} {
  return { name: club.name, sport: club.sport, member_count: club.memberCount };
}
