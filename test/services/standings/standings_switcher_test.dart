import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/services/standings/standings_switcher.dart';

const _uid = 'moi';

ClubTeam _team(
  String id, {
  String clubId = 'c1',
  String? pool,
  List<String> players = const [],
  List<String> coaches = const [],
}) => ClubTeam(
  id: id,
  clubId: clubId,
  name: id,
  playerIds: players,
  coachIds: coaches,
  federation: pool == null
      ? null
      : TeamFederationLink(
          provider: 'ffvb',
          teamKey: 'key-$id',
          teamName: id,
          url: 'https://ffvb/$pool',
        ),
);

PoolStandingRow _row(String key, int rank) => PoolStandingRow(
  key: key,
  rank: rank,
  name: key,
  points: 0,
  played: 0,
  won: 0,
  lost: 0,
  forfeits: 0,
  wins30: 0,
  wins31: 0,
  wins32: 0,
  losses23: 0,
  losses13: 0,
  losses03: 0,
  setsFor: 0,
  setsAgainst: 0,
  pointsFor: 0,
  pointsAgainst: 0,
);

void main() {
  group('buildStandingsGroups', () {
    test('ne garde que les équipes liées et suivies', () {
      final groups = buildStandingsGroups(
        uid: _uid,
        clubs: [
          StandingsClubSource(
            clubId: 'c1',
            clubName: 'Club',
            teams: [
              _team('Seniors F', pool: 'A', coaches: [_uid]),
              _team('M15', pool: 'B'),
              _team('Loisirs', players: [_uid]),
            ],
          ),
        ],
      );
      expect(groups.single.entries.map((entry) => entry.label), ['Seniors F']);
    });

    test('fusionne deux équipes du même club dans la même poule', () {
      final groups = buildStandingsGroups(
        uid: _uid,
        clubs: [
          StandingsClubSource(
            clubId: 'c1',
            clubName: 'Club',
            teams: [
              _team('Seniors F2', pool: 'A', coaches: [_uid]),
              _team('Seniors F', pool: 'A', coaches: [_uid]),
              _team('M15', pool: 'B', coaches: [_uid]),
            ],
          ),
        ],
      );
      final entries = groups.single.entries;
      expect(entries.map((entry) => entry.label), [
        'M15',
        'Seniors F · Seniors F2',
      ]);
      expect(entries.last.primary.id, 'Seniors F');
      expect(entries.last.teamKeys, {'key-Seniors F', 'key-Seniors F2'});
      expect(entries.last.containsTeam('Seniors F2'), isTrue);
    });

    test('club actif en premier puis ordre alphabétique', () {
      StandingsClubSource club(String id, String name) => StandingsClubSource(
        clubId: id,
        clubName: name,
        teams: [
          _team('E-$id', clubId: id, pool: id, players: [_uid]),
        ],
      );
      final groups = buildStandingsGroups(
        uid: _uid,
        activeClubId: 'c3',
        clubs: [
          club('c1', 'Zèbres'),
          club('c2', 'aigles'),
          club('c3', 'Lions'),
        ],
      );
      expect(groups.map((group) => group.clubName), [
        'Lions',
        'aigles',
        'Zèbres',
      ]);
    });

    test('porte les prénoms des enfants au niveau du club et des équipes', () {
      final groups = buildStandingsGroups(
        uid: _uid,
        clubs: [
          StandingsClubSource(
            clubId: 'c1',
            clubName: 'Club',
            childNames: const {'leo': 'Léo', 'emma': 'Emma'},
            teams: [
              _team('M13', pool: 'A', players: ['leo']),
              _team('M15', pool: 'B', players: ['emma']),
              _team('Seniors F', pool: 'C', players: [_uid]),
            ],
          ),
        ],
      );
      final group = groups.single;
      expect(group.childNames, ['Emma', 'Léo']);
      expect(group.entries.map((entry) => entry.childNames), [
        ['Léo'],
        ['Emma'],
        isEmpty,
      ]);
    });

    test('prénom pas encore chargé : poule suivie, prénom masqué', () {
      final groups = buildStandingsGroups(
        uid: _uid,
        clubs: [
          StandingsClubSource(
            clubId: 'c1',
            clubName: 'Club',
            childNames: const {'leo': ''},
            teams: [
              _team('M13', pool: 'A', players: ['leo']),
            ],
          ),
        ],
      );
      final group = groups.single;
      expect(group.entries.single.label, 'M13');
      expect(group.childNames, isEmpty);
      expect(group.entries.single.childNames, isEmpty);
    });
  });

  group('entryForClub', () {
    final group = buildStandingsGroups(
      uid: _uid,
      clubs: [
        StandingsClubSource(
          clubId: 'c1',
          clubName: 'Club',
          teams: [
            _team('A', pool: 'A', players: [_uid]),
            _team('B', pool: 'B', players: [_uid]),
          ],
        ),
      ],
    ).single;

    test('rouvre la dernière équipe vue du club', () {
      expect(entryForClub(group, 'B').primary.id, 'B');
    });

    test('sinon la première', () {
      expect(entryForClub(group, null).primary.id, 'A');
      expect(entryForClub(group, 'disparue').primary.id, 'A');
    });
  });

  test('bestStandingRank prend le meilleur rang des équipes suivies', () {
    final standings = PoolStandings(
      rows: [_row('x', 1), _row('a', 3), _row('b', 5)],
      myTeamKey: 'a',
    );
    expect(bestStandingRank(standings, {'a', 'b'}), 3);
    expect(bestStandingRank(standings, {'z'}), isNull);
    expect(bestStandingRank(null, {'a'}), isNull);
  });
}
