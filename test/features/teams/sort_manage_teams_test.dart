import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/teams/utils/sort_manage_teams.dart';
import 'package:viro_team_v2/models/club_team.dart';

ClubTeam _team({
  required String id,
  required String name,
  List<String> playerIds = const [],
  List<String> coachIds = const [],
}) => ClubTeam(
  id: id,
  clubId: 'club',
  name: name,
  playerIds: playerIds,
  coachIds: coachIds,
);

void main() {
  const me = 'uid-me';

  test('met mes équipes coach/joueur en tête, puis alpha', () {
    final sorted = sortManageTeams(
      [
        _team(id: 'a', name: 'Alpha'),
        _team(id: 'b', name: 'Bravo', coachIds: [me]),
        _team(id: 'c', name: 'Charlie', playerIds: [me]),
        _team(id: 'd', name: 'Delta'),
      ],
      me,
    );
    expect(sorted.map((t) => t.name), [
      'Bravo',
      'Charlie',
      'Alpha',
      'Delta',
    ]);
  });

  test('sans implication : ordre alphabétique seul', () {
    final sorted = sortManageTeams(
      [
        _team(id: 'z', name: 'Zulu'),
        _team(id: 'a', name: 'Alpha'),
      ],
      me,
    );
    expect(sorted.map((t) => t.name), ['Alpha', 'Zulu']);
  });
}
