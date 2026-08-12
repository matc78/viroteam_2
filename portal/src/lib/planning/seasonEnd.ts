/**
 * Fin de saison sportive par défaut : 30 juin de la saison en cours.
 * Avant/le 30 juin → année courante ; après → année suivante.
 */
export function defaultSeasonEndDate(around: Date = new Date()): Date {
  const year =
    around.getMonth() > 5 ||
    (around.getMonth() === 5 && around.getDate() > 30)
      ? around.getFullYear() + 1
      : around.getFullYear();
  return new Date(year, 5, 30);
}

/**
 * Résout la fin de saison : date club si encore valide, sinon défaut.
 */
export function resolveSeasonEndDate(
  configured: Date | null | undefined,
  around: Date = new Date(),
): Date {
  if (configured) {
    const end = new Date(
      configured.getFullYear(),
      configured.getMonth(),
      configured.getDate(),
    );
    const today = new Date(
      around.getFullYear(),
      around.getMonth(),
      around.getDate(),
    );
    if (end.getTime() >= today.getTime()) return end;
  }
  return defaultSeasonEndDate(around);
}

/**
 * Fin de récurrence pour un événement : max(jour événement, fin de saison).
 */
export function recurrenceEndForEventDay(
  eventDay: Date,
  seasonEnd: Date,
): Date {
  const start = new Date(
    eventDay.getFullYear(),
    eventDay.getMonth(),
    eventDay.getDate(),
  );
  const end = new Date(
    seasonEnd.getFullYear(),
    seasonEnd.getMonth(),
    seasonEnd.getDate(),
  );
  return end.getTime() >= start.getTime() ? end : start;
}
