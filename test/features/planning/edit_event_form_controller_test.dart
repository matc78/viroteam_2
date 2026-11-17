import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/planning/utils/edit_event_form_controller.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/services/event_service.dart';

/// Capture les arguments de `updateEventDetails` (le reste n'est pas utilisé).
class _RecordingEventService implements EventService {
  Map<String, Object?>? lastUpdate;

  @override
  Future<void> updateEventDetails({
    required String clubId,
    required String eventId,
    String? title,
    DateTime? date,
    String? startTime,
    String? endTime,
    String? meetingTime,
    String? location,
    String? meetingLocation,
    bool clearMeetingLocation = false,
  }) async {
    lastUpdate = {
      'title': title,
      'date': date,
      'startTime': startTime,
      'endTime': endTime,
      'meetingTime': meetingTime,
      'location': location,
      'meetingLocation': meetingLocation,
      'clearMeetingLocation': clearMeetingLocation,
    };
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

ClubEvent _training({String type = EventTypes.training}) => ClubEvent(
      id: 'e1',
      clubId: 'c1',
      type: type,
      title: 'Senior 1',
      date: DateTime(2026, 11, 10),
      startTime: '18:00',
      endTime: '19:30',
      location: 'Gymnase',
      meetingLocation: 'Parking',
    );

void main() {
  test('rien à écrire tant que rien ne change', () async {
    final form = EditEventFormController(_training());
    final service = _RecordingEventService();
    form.locationController.text = ' Gymnase ';

    expect(form.hasChanges, isFalse);
    expect(await form.save(clubId: 'c1', eventService: service), isFalse);
    expect(service.lastUpdate, isNull);
    form.dispose();
  });

  test('écrit seulement les champs modifiés', () async {
    final form = EditEventFormController(_training());
    final service = _RecordingEventService();
    form.setDate(DateTime(2026, 11, 12));
    form.setStartTime(const TimeOfDay(hour: 19, minute: 0));
    form.setEndTime(const TimeOfDay(hour: 20, minute: 30));

    expect(await form.save(clubId: 'c1', eventService: service), isTrue);
    expect(service.lastUpdate, {
      'title': null,
      'date': DateTime(2026, 11, 12),
      'startTime': '19:00',
      'endTime': '20:30',
      'meetingTime': null,
      'location': null,
      'meetingLocation': null,
      'clearMeetingLocation': false,
    });
    form.dispose();
  });

  test('un lieu de RDV vidé est supprimé', () async {
    final form = EditEventFormController(_training());
    final service = _RecordingEventService();
    form.meetingLocationController.text = '';

    expect(await form.save(clubId: 'c1', eventService: service), isTrue);
    expect(service.lastUpdate?['clearMeetingLocation'], isTrue);
    expect(service.lastUpdate?['meetingLocation'], isNull);
    form.dispose();
  });

  test('le titre d’un événement d’équipe reste figé', () {
    final form = EditEventFormController(_training());
    form.titleController.text = 'Autre chose';

    expect(form.hasEditableTitle, isFalse);
    expect(form.hasChanges, isFalse);
    form.dispose();
  });

  test('bloque une fin avant le début', () {
    final form = EditEventFormController(_training());
    form.setEndTime(const TimeOfDay(hour: 17, minute: 0));

    expect(form.blockingReason, isNotNull);
    form.dispose();
  });
}
