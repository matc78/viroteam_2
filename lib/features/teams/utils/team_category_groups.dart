import 'package:viro_team_v2/config/viro_team_category_tones.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/compare_team_categories.dart';

/// Libellé d’une équipe sans catégorie (aligné [ClubTeam.categoryLabel] et
/// portail `NO_CATEGORY_LABEL`).
String get noTeamCategoryLabel => AppCopy.teams.noCategory;

/// Clé de regroupement de [team] : sa catégorie, ou [noTeamCategoryLabel]
/// si elle est vide ou porte déjà ce libellé (un seul groupe « Sans
/// catégorie »).
String teamCategoryKey(ClubTeam team) {
  final category = team.category?.trim() ?? '';
  if (category.isEmpty ||
      category.toLowerCase() == noTeamCategoryLabel.toLowerCase()) {
    return noTeamCategoryLabel;
  }
  return category;
}

/// Groupe d’équipes d’une même catégorie (liste Gestion).
class TeamCategoryGroup {
  const TeamCategoryGroup({
    required this.category,
    required this.tone,
    required this.teams,
  });

  /// Libellé affiché (catégorie ou [noTeamCategoryLabel]).
  final String category;
  final TeamCategoryTone tone;
  final List<ClubTeam> teams;

  /// Équipes sans coach.
  int get noCoachCount => teams.where((team) => team.coachIds.isEmpty).length;

  /// Équipes sans joueur.
  int get noPlayerCount => teams.where((team) => team.playerIds.isEmpty).length;
}

/// Catégories du club dans l’ordre d’affichage (catalogue du [sport], puis
/// âge croissant), « Sans catégorie » en dernier s’il y en a.
List<String> orderedTeamCategoryLabels(
  Iterable<ClubTeam> teams, {
  String? sport,
}) {
  final categories = <String>[];
  var hasUncategorized = false;
  for (final team in teams) {
    final key = teamCategoryKey(team);
    if (key == noTeamCategoryLabel) {
      hasUncategorized = true;
    } else {
      categories.add(key);
    }
  }
  return [
    ...sortTeamCategories(categories, sport: sport),
    if (hasUncategorized) noTeamCategoryLabel,
  ];
}

/// Couleur de chaque catégorie (libellé → teinte), attribuée dans l’ordre de
/// [orderedCategories] : pas de doublon jusqu’à 11 catégories ;
/// « Sans catégorie » → [TeamCategoryTone.slate]. Aligné portail
/// `assignTeamCategoryTones`.
Map<String, TeamCategoryTone> assignTeamCategoryTones(
  Iterable<String> orderedCategories,
) {
  final tones = <String, TeamCategoryTone>{};
  var index = 0;
  for (final raw in orderedCategories) {
    final category = raw.trim();
    if (tones.containsKey(category)) continue;
    if (category.isEmpty ||
        category.toLowerCase() == noTeamCategoryLabel.toLowerCase()) {
      tones[category] = TeamCategoryTone.slate;
      continue;
    }
    tones[category] = TeamCategoryTone
        .paletteOrder[index % TeamCategoryTone.paletteOrder.length];
    index++;
  }
  return tones;
}

/// Teinte de la catégorie de [team] dans [tones].
TeamCategoryTone teamCategoryToneOf(
  Map<String, TeamCategoryTone> tones,
  ClubTeam team,
) {
  return tones[teamCategoryKey(team)] ?? TeamCategoryTone.slate;
}

/// Regroupe [teams] par catégorie, groupes dans l’ordre des catégories.
/// L’ordre des équipes de chaque groupe est celui de [teams] (déjà trié,
/// ex. « mes équipes d’abord »). Couleurs calculées sur [allTeams] (toutes
/// les équipes du club) pour rester stables quand [teams] est filtré.
List<TeamCategoryGroup> buildTeamCategoryGroups(
  List<ClubTeam> teams, {
  String? sport,
  List<ClubTeam>? allTeams,
}) {
  final tones = assignTeamCategoryTones(
    orderedTeamCategoryLabels(allTeams ?? teams, sport: sport),
  );
  final byCategory = <String, List<ClubTeam>>{};
  for (final team in teams) {
    byCategory.putIfAbsent(teamCategoryKey(team), () => []).add(team);
  }
  return [
    for (final category in orderedTeamCategoryLabels(teams, sport: sport))
      if (byCategory[category] case final groupTeams?)
        TeamCategoryGroup(
          category: category,
          tone: tones[category] ?? TeamCategoryTone.slate,
          teams: groupTeams,
        ),
  ];
}
