import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/services/event_service.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';

DateTime _startOfToday() {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
}

ClubEvent _eventOnDay(
  DateTime day, {
  String id = 'e1',
  String clubId = 'c1',
  List<String> teamMemberIds = const ['authUid'],
}) {
  return ClubEvent(
    id: id,
    clubId: clubId,
    type: EventTypes.training,
    title: 'Entraînement',
    date: day,
    teamMemberIds: teamMemberIds,
  );
}

void main() {
  group('categorizeMemberEvents — fenêtre 14 jours', () {
    test('inclut un event à J+13 dans upcoming et pending', () {
      final today = _startOfToday();
      final j13 = addCalendarDays(today, 13);
      final event = _eventOnDay(j13);

      final result = categorizeMemberEvents([event], memberId: 'authUid');

      expect(result.upcoming, [event]);
      expect(result.pending, [event]);
    });

    test('une réponse sous l’id de la fiche sort l’event de pending', () {
      final today = _startOfToday();
      final event = ClubEvent(
        id: 'e1',
        clubId: 'c1',
        type: EventTypes.training,
        title: 'Entraînement',
        date: addCalendarDays(today, 2),
        teamMemberIds: const ['authUid'],
        rsvp: const {'authUid': 'yes'},
      );

      final result = categorizeMemberEvents([event], memberId: 'authUid');

      expect(result.upcoming, [event]);
      expect(result.pending, isEmpty);
    });

    test('exclut un event à J+14 de upcoming et pending', () {
      final today = _startOfToday();
      final j14 = addCalendarDays(today, 14);
      final event = _eventOnDay(j14);

      final result = categorizeMemberEvents([event], memberId: 'authUid');

      expect(result.upcoming, isEmpty);
      expect(result.pending, isEmpty);
    });

    test('EventService.isWithinUpcomingPlanningWindow — J+13 oui, J+14 non', () {
      final today = _startOfToday();
      expect(
        EventService.isWithinUpcomingPlanningWindow(
          addCalendarDays(today, 13),
        ),
        isTrue,
      );
      expect(
        EventService.isWithinUpcomingPlanningWindow(
          addCalendarDays(today, 14),
        ),
        isFalse,
      );
    });
  });
}
