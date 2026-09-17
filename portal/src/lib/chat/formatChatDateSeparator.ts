/** Date calendaire sans heure (fuseau local). */
function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Libellé de séparateur de jour pour le fil de discussion
 * (Aujourd'hui / Hier / date FR longue).
 */
export function formatChatDateSeparator(date: Date): string {
  const today = dateOnly(new Date());
  const messageDay = dateOnly(date);
  const diffDays = Math.round(
    (today.getTime() - messageDay.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";

  const formatted = messageDay.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(messageDay.getFullYear() !== today.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** True si deux dates sont sur le même jour calendaire. */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
