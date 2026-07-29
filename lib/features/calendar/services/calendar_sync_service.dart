import 'dart:io';

import 'package:add_2_calendar/add_2_calendar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';

/// Ajout / export d'événements vers le calendrier appareil (+ génération `.ics`).
abstract final class CalendarSyncService {
  /// Ajoute un événement au calendrier natif (permission système).
  static Future<bool> addEventToDeviceCalendar(ClubEvent event) {
    final start = _start(event);
    return Add2Calendar.addEvent2Cal(
      Event(
        title: PlanningEventDisplay.calendarTitle(event),
        description: 'ViroTeam',
        location: event.location,
        startDate: start,
        endDate: _end(event, start),
      ),
    );
  }

  /// Partage un fichier `.ics` (import manuel dans l'agenda).
  static Future<void> shareIcsFile({
    required List<ClubEvent> events,
    required String calendarName,
  }) async {
    final content = buildIcs(events: events, calendarName: calendarName);
    final dir = await getTemporaryDirectory();
    final safeName = calendarName
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '');
    final file = File(
      '${dir.path}/viroteam_${safeName.isEmpty ? 'planning' : safeName}.ics',
    );
    await file.writeAsString(content, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'text/calendar')],
        subject: calendarName,
        text: 'Planning ViroTeam — importez ce fichier dans votre calendrier.',
      ),
    );
  }

  /// Contenu iCalendar pour [events].
  static String buildIcs({
    required List<ClubEvent> events,
    String calendarName = 'ViroTeam',
  }) {
    final buffer = StringBuffer()
      ..writeln('BEGIN:VCALENDAR')
      ..writeln('VERSION:2.0')
      ..writeln('PRODID:-//ViroTeam//FR')
      ..writeln('CALSCALE:GREGORIAN')
      ..writeln('METHOD:PUBLISH')
      ..writeln('X-WR-CALNAME:$calendarName');

    for (final event in events) {
      if (event.canceled) continue;
      final start = _start(event);
      final end = _end(event, start);
      final uid = '${event.clubId}-${event.id}@viroteam.app';
      final summary = _escape(PlanningEventDisplay.calendarTitle(event));
      final location = _escape(event.location ?? '');

      buffer
        ..writeln('BEGIN:VEVENT')
        ..writeln('UID:$uid')
        ..writeln('DTSTAMP:${_formatUtc(DateTime.now().toUtc())}')
        ..writeln('DTSTART:${_formatLocal(start)}')
        ..writeln('DTEND:${_formatLocal(end)}')
        ..writeln('SUMMARY:$summary');
      if (location.isNotEmpty) buffer.writeln('LOCATION:$location');
      buffer.writeln('END:VEVENT');
    }

    buffer.writeln('END:VCALENDAR');
    return buffer.toString();
  }

  static DateTime _start(ClubEvent event) =>
      combineEventDateTime(event.date, event.startTime) ??
      DateTime(event.date.year, event.date.month, event.date.day, 18);

  static DateTime _end(ClubEvent event, DateTime start) =>
      combineEventDateTime(event.date, event.endTime) ??
      start.add(const Duration(hours: 2));

  static String _formatUtc(DateTime dt) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${dt.year}${two(dt.month)}${two(dt.day)}T'
        '${two(dt.hour)}${two(dt.minute)}${two(dt.second)}Z';
  }

  static String _formatLocal(DateTime dt) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${dt.year}${two(dt.month)}${two(dt.day)}T'
        '${two(dt.hour)}${two(dt.minute)}${two(dt.second)}';
  }

  static String _escape(String value) => value
      .replaceAll('\\', '\\\\')
      .replaceAll(';', '\\;')
      .replaceAll(',', '\\,')
      .replaceAll('\n', '\\n');
}
