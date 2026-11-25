import 'package:viro_team_v2/models/club_team.dart';

/// Tri de la liste Gestion : équipes où [memberId] est coach ou joueur en
/// tête, puis ordre alphabétique du nom (insensible à la casse).
List<ClubTeam> sortManageTeams(List<ClubTeam> teams, String memberId) {
  if (memberId.isEmpty || teams.length < 2) return List<ClubTeam>.of(teams);

  int involvement(ClubTeam team) {
    if (team.coachIds.contains(memberId) || team.playerIds.contains(memberId)) {
      return 0;
    }
    return 1;
  }

  final sorted = List<ClubTeam>.of(teams);
  sorted.sort((a, b) {
    final byMine = involvement(a).compareTo(involvement(b));
    if (byMine != 0) return byMine;
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  });
  return sorted;
}
