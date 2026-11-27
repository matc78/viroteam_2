import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Noms des équipes que [member] entraîne (`coachTeamIds`), triés.
List<String> resolveCoachedTeamNames(ClubMember member, List<ClubTeam> teams) {
  final names = [
    for (final team in teams)
      if (member.coachTeamIds.contains(team.id)) team.name,
  ];
  names.sort(
    (left, right) => left.toLowerCase().compareTo(right.toLowerCase()),
  );
  return names;
}

/// Badges roster de [memberId] dans [team] (entraîneur, joueur / sparring).
/// Vide hors roster. Un id dans les deux listes reçoit les deux badges.
List<ViroRole> resolveMemberTeamRoles(ClubTeam team, String memberId) {
  final roles = <ViroRole>[];
  if (team.coachIds.contains(memberId)) roles.add(ViroRole.coach);
  if (team.playerIds.contains(memberId)) {
    roles.add(
      team.isSparring(memberId) ? ViroRole.sparring : ViroRole.player,
    );
  }
  return roles;
}

/// Rôle roster de [memberId] dans [team] (ex. « joueur », « entraîneur »,
/// « entraîneur + joueur », « sparring »). Vide hors roster.
String resolveMemberTeamRoleLabel(ClubTeam team, String memberId) {
  return [
    for (final role in resolveMemberTeamRoles(team, memberId))
      switch (role) {
        ViroRole.coach => AppCopy.members.teamRoleCoach,
        ViroRole.sparring => AppCopy.members.teamRoleSparring,
        _ => AppCopy.members.teamRolePlayer,
      },
  ].join(' + ');
}

/// Libellés équipes avec rôle roster (ex. « M18 filles (joueur) »,
/// « Seniors (sparring) »).
List<String> resolveMemberTeamLabels(ClubMember member, List<ClubTeam> teams) {
  final labels = <String>[];

  for (final team in teams) {
    final isPlayer = team.isOnPlayerRoster(member);
    final isCoach = team.isOnCoachRoster(member);
    final inDoc = member.teamIds.contains(team.id);
    if (!isPlayer && !isCoach && !inDoc) continue;

    final role = resolveMemberTeamRoleLabel(team, member.memberId);
    labels.add(role.isEmpty ? team.name : '${team.name} ($role)');
  }

  labels.sort(
    (left, right) => left.toLowerCase().compareTo(right.toLowerCase()),
  );
  return labels;
}
