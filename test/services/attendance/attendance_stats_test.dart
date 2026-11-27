import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';

// Mêmes cas et mêmes chiffres que `portal/src/lib/attendance/attendanceStats.test.ts`.

final _now = DateTime(2026, 11, 26, 12);

ClubEvent _event({
  String id = 'e',
  String type = EventTypes.training,
  DateTime? date,
  String? startTime = '18:00',
  List<String> teamIds = const ['t1'],
  List<String> teamMemberIds = const [],
  Map<String, String> rsvp = const {},
  bool allTeams = false,
  bool canceled = false,
}) => ClubEvent(
  id: id,
  clubId: 'c',
  type: type,
  title: 'Entraînement',
  date: date ?? DateTime(2026, 11, 20),
  startTime: startTime,
  teamIds: teamIds,
  teamMemberIds: teamMemberIds,
  rsvp: rsvp,
  allTeams: allTeams,
  canceled: canceled,
);

const _team = ClubTeam(
  id: 't1',
  clubId: 'c',
  name: 'M15',
  playerIds: ['a', 'b', 'c'],
);
const _names = {'a': 'Alice', 'b': 'Bruno', 'c': 'Chloé'};

void main() {
  group('compteurs', () {
    test('compte oui / peut-être / non / sans réponse', () {
      final counts = eventCounts(
        _event(
          teamMemberIds: ['a', 'b', 'c', 'd'],
          rsvp: {'a': 'yes', 'b': 'no', 'c': 'maybe'},
        ),
      );
      expect(
        [counts.convoked, counts.yes, counts.maybe, counts.no, counts.none],
        [4, 1, 1, 1, 1],
      );
      expect(presenceRate(counts), 25);
      expect(responseRate(counts), 75);
      expect(presenceRate(RsvpCounts.empty), isNull);
    });

    test('limite aux membres demandés', () {
      final counts = eventCounts(
        _event(teamMemberIds: ['a', 'z'], rsvp: {'a': 'yes', 'z': 'yes'}),
        {'a'},
      );
      expect(counts.convoked, 1);
    });
  });

  group('computeTeamAttendance', () {
    final events = [
      _event(
        id: '1',
        teamMemberIds: ['a', 'b', 'c'],
        rsvp: {'a': 'yes', 'b': 'yes'},
      ),
      _event(
        id: '2',
        type: EventTypes.match,
        date: DateTime(2026, 11, 22),
        startTime: '14:00',
        teamMemberIds: ['a', 'b', 'c'],
        rsvp: {'a': 'yes', 'b': 'no'},
      ),
      _event(
        id: '3',
        date: DateTime(2026, 11, 24),
        teamMemberIds: ['a', 'c'],
        rsvp: {'a': 'yes'},
      ),
      _event(
        id: 'future',
        date: DateTime(2026, 12, 1),
        teamMemberIds: ['a'],
        rsvp: {'a': 'yes'},
      ),
      _event(
        id: 'other',
        teamIds: ['t2'],
        teamMemberIds: ['a'],
        rsvp: {'a': 'no'},
      ),
    ];
    final result = computeTeamAttendance(
      team: _team,
      events: events,
      names: _names,
      now: _now,
    );

    test('ignore le futur et les autres équipes', () {
      expect(result.eventCount, 3);
      expect([for (final row in result.events) row.event.id], ['3', '2', '1']);
    });

    test('calcule les taux globaux et par type', () {
      expect(result.rate, 50);
      expect(result.responseRate, 63);
      expect(result.trainingRate, 60);
      expect(result.matchRate, 33);
    });

    test('trie les joueurs du moins présent au plus présent', () {
      expect(
        [for (final p in result.players) (p.name, p.rate)],
        [('Chloé', 0), ('Bruno', 50), ('Alice', 100)],
      );
      expect(result.players.first.isLowResponder, isTrue);
      expect(result.players.last.isLowResponder, isFalse);
      expect([for (final p in result.lowResponders) p.memberId], ['c']);
    });

    test('résume plusieurs équipes', () {
      final summary = summarizeAttendance(
        teams: [_team],
        events: events,
        now: _now,
      );
      expect(summary.eventCount, 3);
      expect(summary.lowResponderIds, {'c'});
      expect(summary.rate, 50);
    });
  });

  group('joueurs et coachs', () {
    const coached = ClubTeam(
      id: 't1',
      clubId: 'c',
      name: 'M15',
      playerIds: ['a', 'b', 'c'],
      coachIds: ['k', 'a'],
    );
    final events = [
      _event(
        id: '1',
        teamMemberIds: ['a', 'b', 'k'],
        rsvp: {'a': 'yes', 'k': 'yes'},
      ),
      _event(id: '2', teamMemberIds: ['a', 'b', 'k'], rsvp: {'k': 'yes'}),
      // Coach seul convoqué : l'événement compte pour les stats mixtes.
      _event(id: '3', teamMemberIds: ['k']),
    ];
    final result = computeTeamAttendance(
      team: coached,
      events: events,
      names: _names,
      now: _now,
    );

    test('sépare les joueurs des coachs (un joueur-coach reste joueur)', () {
      expect(
        [
          for (final row in result.coaches)
            (row.memberId, row.name, row.counts.yes),
        ],
        [('k', 'Coach', 2)],
      );
      expect(result.eventCount, 3);
      expect(result.rate, 25);
      expect(result.trainingRate, 25);
      expect(
        [
          result.allTotals.convoked,
          result.allTotals.yes,
          result.allTotals.none,
        ],
        [7, 3, 4],
      );
      expect(result.allRate, 43);
      expect(result.allResponseRate, 43);
      final first = result.events.firstWhere((row) => row.event.id == '1');
      expect([first.coachConvoked, first.coachYes], [1, 1]);
    });

    test('résume les deux périmètres', () {
      final summary = summarizeAttendance(
        teams: [coached],
        events: events,
        now: _now,
      );
      expect(summary.rate, 25);
      expect(summary.allRate, 43);
    });
  });

  group('périmètre des événements', () {
    test('ignore « tout le club », annulés et ceux du jour sans heure', () {
      final result = computeTeamAttendance(
        team: _team,
        events: [
          _event(
            id: 'ag',
            allTeams: true,
            teamIds: ['t1', 't2'],
            teamMemberIds: ['a'],
          ),
          _event(
            id: 'soir',
            date: DateTime(2026, 11, 26),
            startTime: null,
            teamMemberIds: ['a'],
          ),
          _event(id: 'annule', canceled: true, teamMemberIds: ['a']),
          _event(id: 'ok', teamMemberIds: ['a'], rsvp: {'a': 'yes'}),
        ],
        names: _names,
        now: _now,
      );
      expect([for (final row in result.events) row.event.id], ['ok']);
    });

    test('compte une fois un événement partagé par deux équipes', () {
      const u17 = ClubTeam(
        id: 't2',
        clubId: 'c',
        name: 'U17',
        playerIds: ['a', 'd'],
      );
      final summary = summarizeAttendance(
        teams: [_team, u17],
        events: [
          _event(
            teamIds: ['t1', 't2'],
            teamMemberIds: ['a', 'b', 'd'],
            rsvp: {'a': 'yes'},
          ),
        ],
        now: _now,
      );
      expect(summary.eventCount, 1);
      expect(summary.totals.convoked, 3);
    });

    test('à relancer : sans réponse strictement plus d’une fois sur deux', () {
      expect(
        isLowResponderCounts(const RsvpCounts(convoked: 4, none: 2)),
        isFalse,
      );
      expect(
        isLowResponderCounts(const RsvpCounts(convoked: 4, none: 3)),
        isTrue,
      );
    });
  });

  group('attendancePeriodStart', () {
    test('saison : 1er août précédent', () {
      expect(
        attendancePeriodStart(AttendancePeriod.season, _now),
        DateTime(2026, 8),
      );
      expect(
        attendancePeriodStart(AttendancePeriod.season, DateTime(2027, 3, 10)),
        DateTime(2026, 8),
      );
    });

    test('30 et 90 jours calendaires', () {
      expect(
        attendancePeriodStart(AttendancePeriod.last30Days, _now),
        DateTime(2026, 10, 27),
      );
      expect(
        attendancePeriodStart(AttendancePeriod.last90Days, _now),
        DateTime(2026, 8, 28),
      );
    });
  });

  group('computeMemberTeamAttendance', () {
    final coachTeam = ClubTeam(
      id: 't1',
      clubId: 'c',
      name: 'M15',
      playerIds: const ['a', 'b'],
      coachIds: const ['k'],
    );
    final events = [
      _event(
        id: 'e1',
        type: EventTypes.training,
        teamMemberIds: const ['a', 'k'],
        rsvp: const {'a': 'yes', 'k': 'yes'},
      ),
      _event(
        id: 'e2',
        type: EventTypes.match,
        date: DateTime(2026, 11, 18),
        teamMemberIds: const ['a', 'k'],
        rsvp: const {'a': 'no', 'k': 'yes'},
      ),
    ];

    test('coach seul : taux, entraînements et matchs personnels', () {
      final row = computeMemberTeamAttendance(
        team: coachTeam,
        memberId: 'k',
        events: events,
        now: _now,
      );
      expect(row, isNotNull);
      expect(row!.totals.convoked, 2);
      expect(row.totals.yes, 2);
      expect(row.rate, 100);
      expect(row.training.convoked, 1);
      expect(row.training.yes, 1);
      expect(row.match.convoked, 1);
      expect(row.match.yes, 1);
    });

    test('joueur : inchangé (convocations personnelles)', () {
      final row = computeMemberTeamAttendance(
        team: coachTeam,
        memberId: 'a',
        events: events,
        now: _now,
      );
      expect(row, isNotNull);
      expect(row!.totals.convoked, 2);
      expect(row.totals.yes, 1);
      expect(row.rate, 50);
    });

    test('hors roster : null', () {
      expect(
        computeMemberTeamAttendance(
          team: coachTeam,
          memberId: 'x',
          events: events,
          now: _now,
        ),
        isNull,
      );
    });

    test('sans convocation : null', () {
      expect(
        computeMemberTeamAttendance(
          team: coachTeam,
          memberId: 'b',
          events: events,
          now: _now,
        ),
        isNull,
      );
    });

    test('joueur + coach : une seule fois (comme joueur)', () {
      final dual = ClubTeam(
        id: 't1',
        clubId: 'c',
        name: 'M15',
        playerIds: const ['k'],
        coachIds: const ['k'],
      );
      final row = computeMemberTeamAttendance(
        team: dual,
        memberId: 'k',
        events: [
          _event(
            teamMemberIds: const ['k'],
            rsvp: const {'k': 'yes'},
          ),
        ],
        now: _now,
      );
      expect(row, isNotNull);
      expect(row!.totals.convoked, 1);
      expect(row.totals.yes, 1);
    });
  });
}
