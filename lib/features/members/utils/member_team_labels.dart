import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';

/// Libellés équipes avec rôle roster (ex. « M18 filles (joueur) »).
List<String> resolveMemberTeamLabels(
  ClubMember member,
  List<ClubTeam> teams,
) {
  final labels = <String>[];

  for (final team in teams) {
    final isPlayer = team.isOnPlayerRoster(member);
    final isCoach = team.isOnCoachRoster(member);
    final inDoc = member.teamIds.contains(team.id);
    if (!isPlayer && !isCoach && !inDoc) continue;

    final roles = <String>[];
    if (isCoach) roles.add('coach');
    if (isPlayer) roles.add('joueur');

    if (roles.isEmpty) {
      labels.add(team.name);
    } else {
      labels.add('${team.name} (${roles.join(' + ')})');
    }
  }

  labels.sort(
    (left, right) => left.toLowerCase().compareTo(right.toLowerCase()),
  );
  return labels;
}
