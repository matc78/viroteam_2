/// Fin de saison sportive par défaut : 30 juin de la saison en cours.
DateTime defaultSeasonEndDate([DateTime? around]) {
  final now = around ?? DateTime.now();
  final year = (now.month > 6 || (now.month == 6 && now.day > 30))
      ? now.year + 1
      : now.year;
  return DateTime(year, 6, 30);
}

/// Résout la fin de saison : date club si encore valide, sinon défaut.
DateTime resolveSeasonEndDate(DateTime? configured, [DateTime? around]) {
  final now = around ?? DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  if (configured != null) {
    final end = DateTime(configured.year, configured.month, configured.day);
    if (!end.isBefore(today)) return end;
  }
  return defaultSeasonEndDate(now);
}

/// Fin de récurrence pour un événement : max(jour événement, fin de saison).
DateTime recurrenceEndForEventDay(DateTime eventDay, DateTime seasonEnd) {
  final start = DateTime(eventDay.year, eventDay.month, eventDay.day);
  final end = DateTime(seasonEnd.year, seasonEnd.month, seasonEnd.day);
  return end.isBefore(start) ? start : end;
}
