import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';

ClubEvent _event({
  List<String> teamMemberIds = const ['playerA', 'playerB'],
  Map<String, String> rsvp = const {},
  Map<String, dynamic> legacyAttendance = const {},
}) {
  return ClubEvent(
    id: 'e1',
    clubId: 'c1',
    type: EventTypes.training,
    title: 'Entraînement',
    date: DateTime(2026, 5, 20),
    teamMemberIds: teamMemberIds,
    rsvp: rsvp,
    legacyAttendance: legacyAttendance,
  );
}

void main() {
  group('ClubEvent.calendarDateFromFirestore', () {
    test('avec dateId "20260519" → 2026-05-19', () {
      expect(
        ClubEvent.calendarDateFromFirestore({
          FirestoreFields.dateId: '20260519',
        }),
        DateTime(2026, 5, 19),
      );
    });

    test('sans dateId, timestamp hour >= 22 → jour suivant', () {
      final eveningUtcLegacy = Timestamp.fromDate(
        DateTime(2026, 5, 18, 22, 0),
      );
      expect(
        ClubEvent.calendarDateFromFirestore({
          FirestoreFields.date: eveningUtcLegacy,
        }),
        DateTime(2026, 5, 19),
      );
    });

    test('sans dateId, timestamp matin → même jour', () {
      final morning = Timestamp.fromDate(DateTime(2026, 5, 19, 9, 0));
      expect(
        ClubEvent.calendarDateFromFirestore({
          FirestoreFields.date: morning,
        }),
        DateTime(2026, 5, 19),
      );
    });
  });

  group('ClubEvent.rsvpStatusForUser', () {
    test('none quand aucune réponse', () {
      final event = _event();
      expect(
        event.rsvpStatusForUser(
          'coachUid',
          clubAudienceId: 'coachMemberId',
          memberAudienceKeys: {'coachMemberId', 'coachUid'},
        ),
        RsvpStatus.none,
      );
    });

    test('ne reprend pas le RSVP d\'un autre joueur', () {
      final event = _event(
        rsvp: {'playerB': 'yes'},
      );
      expect(
        event.rsvpStatusForUser(
          'coachUid',
          clubAudienceId: 'coachMemberId',
          memberAudienceKeys: {'coachMemberId', 'coachUid'},
        ),
        RsvpStatus.none,
      );
    });

    test('lit le RSVP sous la clé membre du club', () {
      final event = _event(
        rsvp: {'coachMemberId': 'yes'},
      );
      expect(
        event.rsvpStatusForUser(
          'coachUid',
          clubAudienceId: 'coachMemberId',
          memberAudienceKeys: {'coachMemberId', 'coachUid'},
        ),
        RsvpStatus.yes,
      );
    });

    test('lit la présence legacy v1 pour l\'utilisateur uniquement', () {
      final event = _event(
        legacyAttendance: {
          'coachMemberId': 'none',
          'playerB': 'present',
        },
      );
      expect(
        event.rsvpStatusForUser(
          'coachUid',
          clubAudienceId: 'coachMemberId',
        ),
        RsvpStatus.none,
      );
    });
  });
}
