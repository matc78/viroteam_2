import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/calendar/services/calendar_sync_service.dart';
import 'package:viro_team_v2/models/club_event.dart';

void main() {
  test('buildIcs génère un VCALENDAR avec VEVENT', () {
    final ics = CalendarSyncService.buildIcs(
      calendarName: 'Test Club',
      events: [
        ClubEvent(
          id: 'e1',
          clubId: 'c1',
          type: EventTypes.training,
          title: 'Entraînement U15',
          date: DateTime(2026, 8, 1),
          startTime: '18:00',
          endTime: '20:00',
          location: 'Gymnase',
        ),
      ],
    );

    expect(ics, contains('BEGIN:VCALENDAR'));
    expect(ics, contains('BEGIN:VEVENT'));
    expect(ics, contains('SUMMARY:Entraînement U15'));
    expect(ics, contains('LOCATION:Gymnase'));
    expect(ics, contains('END:VCALENDAR'));
  });

  test('buildIcs ignore les événements annulés', () {
    final ics = CalendarSyncService.buildIcs(
      events: [
        ClubEvent(
          id: 'e1',
          clubId: 'c1',
          type: EventTypes.match,
          title: 'Match',
          date: DateTime(2026, 8, 2),
          canceled: true,
        ),
      ],
    );
    expect(ics, isNot(contains('BEGIN:VEVENT')));
  });
}
