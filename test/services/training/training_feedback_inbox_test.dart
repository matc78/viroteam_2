import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/services/training/training_feedback_inbox.dart';

ClubEvent _training(
  String id,
  DateTime date, {
  List<String> sentBy = const [],
  List<String> players = const ['p1', 'kid'],
}) =>
    ClubEvent(
      id: id,
      clubId: 'club',
      type: 'training',
      title: 'Entraînement',
      date: date,
      teamIds: const ['t1'],
      teamMemberIds: players,
      trainingFeedbackSentBy: sentBy,
    );

void main() {
  final since = DateTime(2026, 11, 1);

  group('coach', () {
    test('envoyé l’emporte sur flemme, flemme sort du compteur', () {
      final events = [
        _training('e1', DateTime(2026, 11, 20)),
        _training('e2', DateTime(2026, 11, 18), sentBy: ['me']),
        _training('e3', DateTime(2026, 11, 15)),
        _training('old', DateTime(2026, 10, 1)),
      ];
      final states = {
        'e2': const TrainingFeedbackUserState(eventId: 'e2', skipped: true),
        'e3': const TrainingFeedbackUserState(eventId: 'e3', skipped: true),
      };
      expect(
        coachFeedbackStatus(event: events[1], uid: 'me', state: states['e2']),
        TrainingFeedbackStatus.sent,
      );
      expect(
        coachFeedbackStatus(event: events[2], uid: 'me', state: states['e3']),
        TrainingFeedbackStatus.skipped,
      );
      expect(
        countPendingCoachFeedback(
          events: events,
          uid: 'me',
          states: states,
          since: since,
        ),
        1,
      );
    });

    test('les retours des collègues suivent leur entraînement', () {
      final rows = buildCoachFeedbackRows(
        events: [
          _training('e1', DateTime(2026, 11, 20), sentBy: ['me', 'alex']),
          _training('e2', DateTime(2026, 11, 18)),
        ],
        uid: 'me',
        states: const {},
      );
      expect(rows, hasLength(3));
      expect(rows[0], isA<TrainingFeedbackEventRow>());
      expect(
        (rows[1] as TrainingFeedbackColleagueRow).coachUid,
        'alex',
      );
      expect(rows[2].event.id, 'e2');
    });
  });

  group('joueur / parent', () {
    const readers = <TrainingFeedbackReader>[
      (memberId: 'p1', teamIds: ['t1'], childFirstName: null),
      (memberId: 'kid', teamIds: ['t1'], childFirstName: 'Inès'),
    ];

    test('un item par fiche et par séance, du plus récent, lus marqués', () {
      final items = buildReceivedTrainingFeedback(
        events: [
          _training('e1', DateTime(2026, 11, 16), sentBy: ['c1', 'c2']),
          _training('e2', DateTime(2026, 11, 20), sentBy: ['c1']),
          _training('none', DateTime(2026, 11, 21)),
        ],
        readers: readers,
        states: const {
          'e1': TrainingFeedbackUserState(
            eventId: 'e1',
            seen: {
              'p1': ['c1', 'c2'],
              'kid': ['c1'],
            },
          ),
        },
        uid: 'p1',
      );
      expect(items.map((i) => '${i.event.id}/${i.memberId}'), [
        'e2/p1',
        'e2/kid',
        'e1/p1',
        'e1/kid',
      ]);
      expect(items[2].isUnseen, isFalse);
      expect(items.last.unseenCoachUids, ['c2']);
      expect(items.last.coachUids, ['c1', 'c2']);
      expect(items[1].childFirstName, 'Inès');
    });

    test('ignore les non-convoqués et mes propres retours', () {
      final items = buildReceivedTrainingFeedback(
        events: [
          _training('e1', DateTime(2026, 11, 20), sentBy: ['p1']),
          _training('e2', DateTime(2026, 11, 20), sentBy: ['c1'], players: ['x']),
        ],
        readers: readers.sublist(0, 1),
        states: const {},
        uid: 'p1',
      );
      expect(items, isEmpty);
    });

    test('admin : consultation hors équipes entraînées, avec retours', () {
      final rows = buildAdminReviewRows(
        events: [
          _training('e1', DateTime(2026, 11, 20), sentBy: ['c1']),
          _training('e2', DateTime(2026, 11, 19)),
        ],
        coachTeamIds: const {},
      );
      expect(rows.map((r) => r.event.id), ['e1']);
      expect(
        buildAdminReviewRows(
          events: [_training('e1', DateTime(2026, 11, 20), sentBy: ['c1'])],
          coachTeamIds: const {'t1'},
        ),
        isEmpty,
      );
    });
  });
}
