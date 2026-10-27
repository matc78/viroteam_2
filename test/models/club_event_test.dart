import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';

ClubEvent _event({
  List<String> teamMemberIds = const ['playerA', 'playerB'],
  Map<String, String> rsvp = const {},
  Map<String, DateTime> rsvpUpdatedAt = const {},
  Map<String, DateTime> seenAt = const {},
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
    rsvpUpdatedAt: rsvpUpdatedAt,
    seenAt: seenAt,
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

    test('sans dateId, minuit UTC → même jour, quel que soit le fuseau', () {
      expect(
        ClubEvent.calendarDateFromFirestore({
          FirestoreFields.date: Timestamp.fromDate(DateTime.utc(2026, 5, 19)),
        }),
        DateTime(2026, 5, 19),
      );
    });

    test(
      'sans dateId, legacy minuit Europe (22h UTC la veille) → jour suivant',
      () {
        expect(
          ClubEvent.calendarDateFromFirestore({
            FirestoreFields.date: Timestamp.fromDate(
              DateTime.utc(2026, 5, 18, 22),
            ),
          }),
          DateTime(2026, 5, 19),
        );
      },
    );

    test('sans dateId, timestamp en matinée UTC → même jour', () {
      expect(
        ClubEvent.calendarDateFromFirestore({
          FirestoreFields.date: Timestamp.fromDate(
            DateTime.utc(2026, 5, 19, 9),
          ),
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
      final event = _event(rsvp: {'playerB': 'yes'});
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
      final event = _event(rsvp: {'coachMemberId': 'yes'});
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
        legacyAttendance: {'coachMemberId': 'none', 'playerB': 'present'},
      );
      expect(
        event.rsvpStatusForUser('coachUid', clubAudienceId: 'coachMemberId'),
        RsvpStatus.none,
      );
    });
  });

  group('ClubEvent.rsvpUpdatedAtForUser', () {
    final t1 = DateTime(2026, 10, 12, 13, 45);

    test('lit le timestamp de la clé qui porte le statut', () {
      final event = _event(
        rsvp: {'playerA': 'yes'},
        rsvpUpdatedAt: {'playerA': t1},
      );
      expect(event.rsvpUpdatedAtForUser('playerA'), t1);
    });

    test('ignore un timestamp porté par une autre clé que le statut', () {
      final event = _event(
        rsvp: {'uidA': 'no'},
        rsvpUpdatedAt: {'playerA': t1},
      );
      expect(
        event.rsvpUpdatedAtForUser('uidA', clubAudienceId: 'playerA'),
        isNull,
      );
    });

    test('null sans réponse, même avec un timestamp résiduel', () {
      final event = _event(rsvpUpdatedAt: {'playerA': t1});
      expect(event.rsvpUpdatedAtForUser('playerA'), isNull);
    });
  });

  group('ClubEvent.seenAtForUser / awaitsSeenBy', () {
    final seen = DateTime(2026, 10, 12, 9, 0);

    test('retrouve la vue sous un alias du membre', () {
      final event = _event(seenAt: {'playerA': seen});
      expect(event.seenAtForUser('uidA', clubAudienceId: 'playerA'), seen);
      expect(event.awaitsSeenBy('uidA', clubAudienceId: 'playerA'), isFalse);
    });

    test('awaitsSeenBy : vrai sans réponse ni vue, faux après réponse', () {
      expect(_event().awaitsSeenBy('playerA'), isTrue);
      expect(_event(rsvp: {'playerA': 'yes'}).awaitsSeenBy('playerA'), isFalse);
    });
  });
}
