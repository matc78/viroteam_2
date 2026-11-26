import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/team_federation.dart';

/// Club suivi par l'utilisateur, source du sélecteur de classements.
class StandingsClubSource {
  const StandingsClubSource({
    required this.clubId,
    required this.clubName,
    required this.teams,
    this.childNames = const {},
  });

  final String clubId;
  final String clubName;

  /// Équipes visibles du club (toutes, filtrées ensuite).
  final List<ClubTeam> teams;

  /// Enfants suivis dans le club : id de fiche → prénom (vide tant qu'il
  /// n'est pas chargé : l'enfant compte, son prénom n'est pas affiché).
  final Map<String, String> childNames;
}

/// Un classement du sélecteur : une poule fédérale d'un club. Plusieurs
/// équipes du club dans la même poule partagent une seule entrée.
class StandingsEntry {
  const StandingsEntry({
    required this.clubId,
    required this.teams,
    this.childNames = const [],
  });

  final String clubId;

  /// Équipes suivies de la poule, triées par nom (au moins une).
  final List<ClubTeam> teams;

  /// Prénoms des enfants suivis dans ces équipes.
  final List<String> childNames;

  /// Équipe dont on ouvre le classement.
  ClubTeam get primary => teams.first;

  /// Libellé de la puce : noms des équipes.
  String get label => teams.map((team) => team.name).join(' · ');

  /// Clés fédérales des équipes suivies (lignes à mettre en avant).
  Set<String> get teamKeys => {
    for (final team in teams)
      if (team.federation != null) team.federation!.teamKey,
  };

  /// `true` si [teamId] fait partie de l'entrée.
  bool containsTeam(String teamId) => teams.any((team) => team.id == teamId);
}

/// Classements suivis dans un club.
class StandingsClubGroup {
  const StandingsClubGroup({
    required this.clubId,
    required this.clubName,
    required this.entries,
    this.childNames = const [],
  });

  final String clubId;
  final String clubName;
  final List<StandingsEntry> entries;

  /// Prénoms des enfants suivis dans les équipes du club.
  final List<String> childNames;
}

/// Regroupe par club les équipes liées à une poule que [uid] suit (joueur,
/// coach) ou qu'un de ses enfants suit, fusionne les équipes d'un même club
/// partageant une poule, puis trie : club actif d'abord, puis par nom.
/// Les clubs sans classement suivi sont omis.
List<StandingsClubGroup> buildStandingsGroups({
  required String uid,
  required List<StandingsClubSource> clubs,
  String? activeClubId,
}) {
  final groups = <StandingsClubGroup>[];
  for (final club in clubs) {
    final teamsByPool = <String, List<ClubTeam>>{};
    final childrenByPool = <String, Set<String>>{};
    for (final team in club.teams) {
      final federation = team.federation;
      if (federation == null) continue;
      final roster = {...team.playerIds, ...team.coachIds};
      final children = [
        for (final child in club.childNames.entries)
          if (roster.contains(child.key)) child.value,
      ];
      if (!roster.contains(uid) && children.isEmpty) continue;
      final poolKey = federation.poolKey;
      teamsByPool.putIfAbsent(poolKey, () => []).add(team);
      childrenByPool.putIfAbsent(poolKey, () => {}).addAll(children);
    }
    if (teamsByPool.isEmpty) continue;

    final entries = [
      for (final pool in teamsByPool.entries)
        StandingsEntry(
          clubId: club.clubId,
          teams: [...pool.value]..sort(_byTeamName),
          // Prénom vide = pas encore chargé : compte pour suivre la poule,
          // mais n'est pas affiché.
          childNames: [
            for (final name in childrenByPool[pool.key]!)
              if (name.isNotEmpty) name,
          ]..sort(),
        ),
    ]..sort((a, b) => _compareNames(a.label, b.label));
    groups.add(
      StandingsClubGroup(
        clubId: club.clubId,
        clubName: club.clubName,
        entries: entries,
        childNames: {for (final entry in entries) ...entry.childNames}.toList()
          ..sort(),
      ),
    );
  }
  groups.sort((a, b) {
    if (a.clubId == activeClubId) return -1;
    if (b.clubId == activeClubId) return 1;
    return _compareNames(a.clubName, b.clubName);
  });
  return groups;
}

/// Entrée contenant l'équipe [teamId] du club [clubId], `null` sinon.
StandingsEntry? findStandingsEntry(
  List<StandingsClubGroup> groups, {
  required String clubId,
  required String teamId,
}) {
  for (final group in groups) {
    if (group.clubId != clubId) continue;
    for (final entry in group.entries) {
      if (entry.containsTeam(teamId)) return entry;
    }
  }
  return null;
}

/// Entrée à ouvrir dans [group] : celle de [lastTeamId] si elle y est
/// encore, sinon la première.
StandingsEntry entryForClub(StandingsClubGroup group, String? lastTeamId) {
  if (lastTeamId != null) {
    for (final entry in group.entries) {
      if (entry.containsTeam(lastTeamId)) return entry;
    }
  }
  return group.entries.first;
}

/// Meilleur rang parmi [teamKeys] dans [standings], `null` si aucune de ces
/// équipes n'est classée.
int? bestStandingRank(PoolStandings? standings, Set<String> teamKeys) {
  if (standings == null) return null;
  int? best;
  for (final row in standings.rows) {
    if (!teamKeys.contains(row.key) || row.rank <= 0) continue;
    if (best == null || row.rank < best) best = row.rank;
  }
  return best;
}

int _byTeamName(ClubTeam a, ClubTeam b) => _compareNames(a.name, b.name);

int _compareNames(String a, String b) =>
    a.toLowerCase().compareTo(b.toLowerCase());
