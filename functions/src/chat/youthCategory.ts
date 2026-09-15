/** Heuristique catégories jeunes (≤ 13) — alignée app Flutter. */
export function isYouthTeamCategory(category: unknown): boolean {
  if (typeof category !== "string") return false;
  const normalized = category.trim().toLowerCase();
  if (!normalized) return false;

  const match = /(?:^|[^a-z0-9])(?:u|m|-)(\d{1,2})(?:[^0-9]|$)/.exec(
    normalized,
  );
  if (match) {
    const age = Number(match[1]);
    if (Number.isFinite(age)) return age <= 13;
  }

  const range = /(\d{1,2})\s*\/\s*(\d{1,2})\s*ans/.exec(normalized);
  if (range) {
    const high = Number(range[2]);
    if (Number.isFinite(high)) return high <= 13;
  }
  return false;
}
