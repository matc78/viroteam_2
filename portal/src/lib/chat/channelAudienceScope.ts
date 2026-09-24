/** Type de cible pour un canal admin (hors « tout le club », déjà sync). */
export type ChannelAudienceScopeType = "categories" | "teams" | "parents";

/** Sélection d’audience pour créer un canal. */
export type ChannelAudienceScope = {
  scopeType: ChannelAudienceScopeType;
  scopeIds: string[];
};

export const CHANNEL_AUDIENCE_SCOPE_LABELS: Record<
  ChannelAudienceScopeType,
  string
> = {
  categories: "Catégories",
  teams: "Équipes",
  parents: "Parents d’équipes",
};

/** Clé système idempotente pour un scope multi. */
export function channelScopeSystemKey(
  scopeType: ChannelAudienceScopeType,
  scopeIds: string[],
): string {
  const sorted = [...scopeIds]
    .map((id) => id.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fr"));
  if (scopeType === "categories") {
    return `category:${sorted.join("|")}`;
  }
  if (scopeType === "teams") {
    return `custom-teams:${sorted.join("|")}`;
  }
  return `custom-parents:${sorted.join("|")}`;
}
