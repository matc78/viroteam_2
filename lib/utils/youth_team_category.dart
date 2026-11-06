import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/team_categories.dart';

/// Plafond d’âge « moins de 15 ans » pour l’invitation parent (U15 / M15 / -15).
const int under15TeamCategoryMaxAge = 15;

/// Catégories nominales (sans U/M/-) considérées comme moins de 15 ans.
const Set<String> _under15NamedCategories = {
  // Tennis (parcours enfants)
  'galaxie rouge',
  'galaxie orange',
  'galaxie vert',
  // Judo
  'éveil',
  'mini-poussin',
  'poussin',
  'benjamin',
  'minime',
  // Natation
  'avenirs',
  'benjamins',
};

/// True si [category] désigne une équipe de jeunes selon [maxAge].
///
/// Reconnaît `U15`, `M14`, `-13`, les plages `13/14 ans`, et — pour le
/// plafond parents ([under15TeamCategoryMaxAge]) — les libellés nominaux
/// du catalogue sport (judo, natation, galaxies tennis).
bool isYouthTeamCategory(
  String? category, {
  int maxAge = 13,
}) {
  if (category == null) return false;
  final normalized = category.trim().toLowerCase();
  if (normalized.isEmpty) return false;

  if (maxAge >= under15TeamCategoryMaxAge &&
      _under15NamedCategories.contains(normalized)) {
    return true;
  }

  final match = RegExp(
    r'(?:^|[^a-z0-9])(?:u|m|-)(\d{1,2})(?:[^0-9]|$)',
  ).firstMatch(normalized);
  if (match != null) {
    final age = int.tryParse(match.group(1)!);
    if (age != null) return age <= maxAge;
  }

  final range = RegExp(r'(\d{1,2})\s*/\s*(\d{1,2})\s*ans').firstMatch(normalized);
  if (range != null) {
    final high = int.tryParse(range.group(2)!);
    if (high != null) return high <= maxAge;
  }

  return false;
}

/// True si [category] correspond à des joueurs de moins de 15 ans.
bool isUnder15TeamCategory(String? category) =>
    isYouthTeamCategory(category, maxAge: under15TeamCategoryMaxAge);

/// True si au moins une équipe de [teams] a une catégorie moins de 15 ans.
///
/// Sans équipe (liste vide), retourne `false`. Si [sport] est fourni, un
/// match exact sur le sous-ensemble catalogue du sport est aussi accepté.
bool memberHasUnder15Team({
  required Iterable<ClubTeam> teams,
  String? sport,
}) {
  final catalog = sport == null || sport.trim().isEmpty
      ? const <String>{}
      : under15TeamCategoriesForSport(sport).map((c) => c.toLowerCase()).toSet();

  for (final team in teams) {
    final category = team.category;
    if (category == null || category.trim().isEmpty) continue;
    if (catalog.contains(category.trim().toLowerCase())) return true;
    if (isUnder15TeamCategory(category)) return true;
  }
  return false;
}

/// Sous-ensemble des catégories catalogue [teamCategoriesForSport] ≤ 15 ans.
List<String> under15TeamCategoriesForSport(String sportName) {
  return teamCategoriesForSport(sportName)
      .where(isUnder15TeamCategory)
      .toList(growable: false);
}
