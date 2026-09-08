/**
 * Détermine quels rappels auto envoyer à la création (trop tard pour attendre
 * le créneau 18:30).
 *
 * - ≤ 2 jours : rappel J-2 uniquement
 * - ≤ 7 jours : rappel J-7 uniquement
 * - sinon : aucun immédiat
 */
export function immediateReminderKinds(daysUntil: number): Array<"j7" | "j2"> {
  if (daysUntil < 0) return [];
  if (daysUntil <= 2) return ["j2"];
  if (daysUntil <= 7) return ["j7"];
  return [];
}

/** Champs dont le changement déclenche « reporté ». */
export function isEventPostponedChange(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  if (!before) return false;
  return (
    stringifyField(before.dateId) !== stringifyField(after.dateId) ||
    stringifyField(before.startTime) !== stringifyField(after.startTime) ||
    timestampMillis(before.date) !== timestampMillis(after.date)
  );
}

/** Champs dont le changement déclenche « modifié » (hors report / annulation). */
export function isEventContentModified(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  if (!before) return false;
  const keys = ["title", "location", "matchVenue", "endTime", "meetingTime", "type"];
  return keys.some(
    (key) => stringifyField(before[key]) !== stringifyField(after[key]),
  );
}

/** True si seuls les champs techniques push ont changé. */
export function isOnlyPushBookkeepingChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  const bookkeeping = new Set([
    "reminderSentJ7",
    "reminderSentJ2",
    "lastManualPushAt",
  ]);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (bookkeeping.has(key)) continue;
    if (stringifyField(before[key]) !== stringifyField(after[key])) {
      return false;
    }
  }
  return true;
}

function stringifyField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return millis != null ? String(millis) : "";
  }
  return JSON.stringify(value);
}

function timestampMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : null;
  }
  if (value instanceof Date) return value.getTime();
  return null;
}
