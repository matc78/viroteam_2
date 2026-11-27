import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_team_category_tones.dart';
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/models/club_team.dart';

ClubTeam _team(
  String id, {
  String? category,
  List<String> players = const ['p'],
  List<String> coaches = const ['c'],
}) => ClubTeam(
  id: id,
  clubId: 'club1',
  name: 'Équipe $id',
  category: category,
  playerIds: players,
  coachIds: coaches,
);

void main() {
  group('assignTeamCategoryTones', () {
    test('suit l’ordre de la palette du portail, gris pour Sans catégorie', () {
      final tones = assignTeamCategoryTones([
        'M11',
        'M13',
        'Sans catégorie',
        'M15',
      ]);
      expect(tones['M11'], TeamCategoryTone.blue);
      expect(tones['M13'], TeamCategoryTone.orange);
      expect(tones['M15'], TeamCategoryTone.green);
      expect(tones['Sans catégorie'], TeamCategoryTone.slate);
    });

    test('pas de doublon jusqu’à 11 catégories', () {
      final tones = assignTeamCategoryTones([
        for (var i = 1; i <= 11; i++) 'C$i',
      ]);
      expect(tones.values.toSet().length, 11);
      expect(tones.values, isNot(contains(TeamCategoryTone.slate)));
    });
  });

  group('buildTeamCategoryGroups', () {
    test('groupe par catégorie triée, Sans catégorie en dernier', () {
      final groups = buildTeamCategoryGroups([
        _team('a', category: 'M15'),
        _team('b'),
        _team('c', category: 'M11'),
        _team('d', category: 'M15'),
      ]);
      expect(groups.map((g) => g.category), ['M11', 'M15', 'Sans catégorie']);
      expect(groups[1].teams.map((t) => t.id), ['a', 'd']);
    });

    test('compte les équipes sans coach / sans joueur', () {
      final groups = buildTeamCategoryGroups([
        _team('a', category: 'M11', coaches: const []),
        _team('b', category: 'M11', players: const [], coaches: const []),
      ]);
      expect(groups.single.noCoachCount, 2);
      expect(groups.single.noPlayerCount, 1);
    });

    test('couleurs stables quand la liste est filtrée', () {
      final all = [_team('a', category: 'M11'), _team('b', category: 'M13')];
      final groups = buildTeamCategoryGroups([all[1]], allTeams: all);
      expect(groups.single.tone, TeamCategoryTone.orange);
    });

    test('teamCategoryToneOf retombe sur gris', () {
      final tones = assignTeamCategoryTones(['M11']);
      expect(teamCategoryToneOf(tones, _team('x')), TeamCategoryTone.slate);
      expect(
        teamCategoryToneOf(tones, _team('y', category: 'M11')),
        TeamCategoryTone.blue,
      );
    });

    test(
      'un seul groupe « Sans catégorie » même si une catégorie porte ce nom',
      () {
        final groups = buildTeamCategoryGroups([
          _team('a', category: noTeamCategoryLabel),
          _team('b'),
          _team('c', category: 'M11'),
        ]);
        expect(groups.map((group) => group.category), [
          'M11',
          noTeamCategoryLabel,
        ]);
        expect(groups.last.teams.map((team) => team.id), ['a', 'b']);
      },
    );

    test('ordre des catégories sans accents ni casse (parité portail)', () {
      expect(
        orderedTeamCategoryLabels([
          _team('a', category: 'Loisir'),
          _team('b', category: 'Élite'),
        ]),
        ['Élite', 'Loisir'],
      );
    });
  });
}
