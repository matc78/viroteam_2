import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';

const _marly = 'marly-le-roi-volley-ball';

PoolMatch _match({
  required String code,
  required int round,
  required DateTime? date,
  required String homeKey,
  required String awayKey,
  String? venue,
  PoolMatchScore? score,
}) => PoolMatch(
  code: code,
  round: round,
  date: date,
  time: '15:00',
  homeKey: homeKey,
  homeName: homeKey.toUpperCase(),
  awayKey: awayKey,
  awayName: awayKey.toUpperCase(),
  venue: venue,
  score: score,
);

void main() {
  group('displayPoolTeamName', () {
    test('rend les noms FFVB lisibles', () {
      expect(displayPoolTeamName('USM DE VIROFLAY'), 'USM de Viroflay');
      expect(
        displayPoolTeamName('MARLY-LE-ROI VOLLEY-BALL'),
        'Marly-le-Roi Volley-Ball',
      );
      expect(
        displayPoolTeamName("VOLLEY-BALL BOIS D'ARCY 2"),
        "Volley-Ball Bois d'Arcy 2",
      );
      expect(
        displayPoolTeamName('ENTENTE SPORTIVE DU PERRAY'),
        'Entente Sportive du Perray',
      );
    });
  });

  group('buildPoolTeamSeason', () {
    // Parcours réel de Marly (poule 1MB, journées 1 à 5).
    final matches = [
      _match(
        code: '1MBA001',
        round: 1,
        date: DateTime(2026, 10, 4),
        homeKey: 'chevreuse',
        awayKey: _marly,
        venue: 'GYMNASE DES TROIS RIVIERES',
        score: const PoolMatchScore(home: 0, away: 3, sets: ['18-25']),
      ),
      _match(
        code: '1MBA009',
        round: 3,
        date: DateTime(2026, 11, 8),
        homeKey: _marly,
        awayKey: 'montigny',
        venue: 'GYMNASE DU CHAMP DES OISEAUX',
        score: const PoolMatchScore(home: 3, away: 0),
      ),
      _match(
        code: '1MBA005',
        round: 2,
        date: DateTime(2026, 10, 11),
        homeKey: 'viroflay',
        awayKey: _marly,
        venue: 'GAILLON',
        score: const PoolMatchScore(home: 3, away: 2),
      ),
      _match(
        code: '1MBA013',
        round: 4,
        date: DateTime(2026, 11, 22),
        homeKey: 'velizy',
        awayKey: _marly,
        score: const PoolMatchScore(home: 3, away: 0),
      ),
      _match(
        code: '1MBA017',
        round: 5,
        date: DateTime(2026, 11, 29),
        homeKey: _marly,
        awayKey: 'bois-d-arcy',
        venue: 'GYMNASE DU CHAMP DES OISEAUX',
      ),
      _match(
        code: '1MBX999',
        round: 9,
        date: null,
        homeKey: _marly,
        awayKey: 'perray',
        venue: 'GYMNASE ANNEXE',
      ),
      _match(
        code: '1MBA002',
        round: 1,
        date: DateTime(2026, 10, 3),
        homeKey: 'perray',
        awayKey: 'montigny',
      ),
    ];
    const standings = PoolStandings(
      myTeamKey: 'viroflay',
      rows: [
        PoolStandingRow(key: _marly, rank: 6, name: 'MARLY', points: 7),
      ],
    );

    test('ordonne le parcours et calcule forme, bilans et salles', () {
      final season = buildPoolTeamSeason(
        standings: standings,
        matches: matches,
        teamKey: _marly,
      )!;
      expect(season.row?.rank, 6);
      expect(season.isMyTeam, isFalse);
      expect(season.played.map((m) => m.code), [
        '1MBA013',
        '1MBA009',
        '1MBA005',
        '1MBA001',
      ]);
      // Forme : 5 derniers chronologiques (ancien → récent).
      expect(season.form, [true, false, true, false]);
      expect(season.homeWon, 1);
      expect(season.homeLost, 0);
      expect(season.awayWon, 1);
      expect(season.awayLost, 2);
      expect(season.homeVenues, [
        'GYMNASE DU CHAMP DES OISEAUX',
        'GYMNASE ANNEXE',
      ]);
      expect(season.upcoming.map((m) => m.code), ['1MBA017', '1MBX999']);
      final mostRecent = season.played.first;
      expect(mostRecent.code, '1MBA013');
      expect(mostRecent.isHome, isFalse);
      expect(mostRecent.us, 0);
      final firstAway = season.played.last;
      expect(firstAway.code, '1MBA001');
      expect(firstAway.isHome, isFalse);
      expect(firstAway.us, 3);
      expect(firstAway.sets, ['25-18']);
    });

    test('garde les 5 derniers résultats seulement', () {
      final many = List.generate(
        7,
        (i) => _match(
          code: 'M$i',
          round: i + 1,
          date: DateTime(2026, 10, i + 1),
          homeKey: _marly,
          awayKey: 'x$i',
          score: PoolMatchScore(home: i.isEven ? 3 : 0, away: i.isEven ? 0 : 3),
        ),
      );
      final season = buildPoolTeamSeason(
        standings: null,
        matches: many,
        teamKey: _marly,
      )!;
      expect(season.form, [true, false, true, false, true]);
    });

    test('équipe inconnue → null', () {
      expect(
        buildPoolTeamSeason(standings: standings, matches: matches, teamKey: 'zz'),
        isNull,
      );
    });
  });
}
