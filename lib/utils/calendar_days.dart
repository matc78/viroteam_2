/// Arithmétique en jours **calendaires**, insensible aux changements d'heure.
///
/// `date.add(Duration(days: n))` ajoute n × 24 h : en heure locale, autour
/// d'un passage heure d'été / d'hiver, minuit + 24 h tombe à 23 h la veille
/// ou à 1 h du jour suivant. Ces helpers conservent l'heure murale.
library;

/// [date] décalée de [days] jours calendaires, même heure murale.
DateTime addCalendarDays(DateTime date, int days) {
  if (date.isUtc) {
    return DateTime.utc(
      date.year,
      date.month,
      date.day + days,
      date.hour,
      date.minute,
      date.second,
      date.millisecond,
      date.microsecond,
    );
  }
  return DateTime(
    date.year,
    date.month,
    date.day + days,
    date.hour,
    date.minute,
    date.second,
    date.millisecond,
    date.microsecond,
  );
}

/// Nombre de jours calendaires de [from] à [to] (négatif si [to] est avant),
/// heures ignorées.
int calendarDaysBetween(DateTime from, DateTime to) {
  final fromDay = DateTime.utc(from.year, from.month, from.day);
  final toDay = DateTime.utc(to.year, to.month, to.day);
  return toDay.difference(fromDay).inDays;
}
