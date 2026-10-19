import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';

void main() {
  group('addCalendarDays', () {
    test('traverse les changements d’heure sans dériver (minuit reste minuit)',
        () {
      // Couvre les deux bascules 2026 (29/03 et 25/10) quel que soit le
      // fuseau de la machine : chaque pas tombe sur le jour suivant à 0 h.
      var day = DateTime(2026, 1, 1);
      for (var step = 0; step < 400; step++) {
        final next = addCalendarDays(day, 1);
        expect(next.hour, 0, reason: 'après $day');
        expect(calendarDaysBetween(day, next), 1, reason: 'après $day');
        day = next;
      }
    });

    test('jour du passage à l’heure d’hiver : J+1 = 26/10', () {
      expect(
        addCalendarDays(DateTime(2026, 10, 25), 1),
        DateTime(2026, 10, 26),
      );
      expect(
        addCalendarDays(DateTime(2026, 10, 19), 14),
        DateTime(2026, 11, 2),
      );
    });

    test('conserve l’heure murale et gère les fins de mois', () {
      expect(
        addCalendarDays(DateTime(2026, 3, 25, 19, 30), 7),
        DateTime(2026, 4, 1, 19, 30),
      );
      expect(addCalendarDays(DateTime(2026, 3, 1), -1), DateTime(2026, 2, 28));
    });

    test('conserve le mode UTC', () {
      final next = addCalendarDays(DateTime.utc(2026, 10, 25, 12), 1);
      expect(next.isUtc, isTrue);
      expect(next, DateTime.utc(2026, 10, 26, 12));
    });
  });

  group('calendarDaysBetween', () {
    test('ignore les heures et les changements d’heure', () {
      expect(
        calendarDaysBetween(DateTime(2026, 3, 20, 23), DateTime(2026, 4, 2)),
        13,
      );
      expect(
        calendarDaysBetween(DateTime(2026, 10, 20), DateTime(2026, 11, 2, 1)),
        13,
      );
      expect(calendarDaysBetween(DateTime(2026, 5, 2), DateTime(2026, 5, 1)), -1);
    });
  });
}
