import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/models/club_event.dart';

ClubEvent _event({
  required String type,
  required String title,
}) {
  return ClubEvent(
    id: 'e1',
    clubId: 'c1',
    type: type,
    title: title,
    date: DateTime(2026, 9, 28),
  );
}

void main() {
  group('PlanningEventDisplay.detailFromStoredTitle', () {
    test('retire le préfixe type des titres portail', () {
      final event = _event(
        type: EventTypes.training,
        title: 'Entraînement - sénior 1',
      );
      expect(PlanningEventDisplay.detailFromStoredTitle(event), 'sénior 1');
    });

    test('conserve le nom d’équipe Flutter brut', () {
      final event = _event(
        type: EventTypes.training,
        title: 'sénior 1',
      );
      expect(PlanningEventDisplay.detailFromStoredTitle(event), 'sénior 1');
    });

    test('ignore un titre égal au type seul', () {
      final event = _event(
        type: EventTypes.match,
        title: 'Match',
      );
      expect(PlanningEventDisplay.detailFromStoredTitle(event), isNull);
    });
  });

  group('PlanningEventDisplay.cardTitleLine', () {
    test('n’affiche Entraînement qu’une fois', () {
      final event = _event(
        type: EventTypes.training,
        title: 'Entraînement - sénior 1',
      );
      expect(
        PlanningEventDisplay.cardTitleLine(event),
        'Entraînement · sénior 1',
      );
    });
  });
}
