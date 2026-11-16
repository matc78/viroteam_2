import type { ClubRecord } from "@/lib/firebase/clubService";
import type { ViroUserProfile } from "@/lib/firebase/types";


/** Type de groupe PostHog du club actif (aligné app : `AnalyticsService.clubGroupType`). */
export const CLUB_GROUP_TYPE = "club";

/**
 * Propriétés « personne » PostHog, sans PII (ni nom, ni e-mail) : parent ou
 * non, nombre de clubs (membre ou parent). Les droits vivent sur chaque fiche
 * club, pas sur le compte. Mêmes clés que l’app (`analyticsPersonProperties`).
 */
export function analyticsPersonProperties(profile: ViroUserProfile): {
  is_parent: boolean;
  club_count: number;
} {
  const clubIds = new Set([
    ...profile.memberClubIds,
    ...profile.parentClubIds,
  ]);
  return {
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
