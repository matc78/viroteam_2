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

  group('Réunion', () {
    test('le titre saisi suit le type en tête de tuile', () {
      final event = _event(type: EventTypes.meeting, title: 'AG annuelle');
      expect(PlanningEventDisplay.headline(event), 'Réunion · AG annuelle');
      expect(
        PlanningEventDisplay.calendarTitle(event),
        'Réunion · AG annuelle',
      );
    });

    test('sans titre (ou titre portail « Réunion ») : type seul', () {
      expect(
        PlanningEventDisplay.headline(
          _event(type: EventTypes.meeting, title: ''),
        ),
        'Réunion',
      );
      expect(
        PlanningEventDisplay.headline(
          _event(type: EventTypes.meeting, title: 'Réunion'),
        ),
        'Réunion',
      );
    });

    test('normalisation Firestore et absence d’équipe', () {
      expect(ClubEvent.normalizeEventType('meeting'), EventTypes.meeting);
      expect(ClubEvent.normalizeEventType('Réunion'), EventTypes.meeting);
      expect(EventTypes.isTeamless(EventTypes.meeting), isTrue);
      expect(EventTypes.isTeamless(EventTypes.training), isFalse);
    });
  });
}
