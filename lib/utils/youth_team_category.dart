/// Détecte les catégories d’équipe « jeunes » (≤ U13 / M13 / -13).
///
/// Heuristique produit pour le chat (restrictions futures mineurs).
/// Exemples matchés : `U12`, `M13`, `-11`, `U 9`, `u13 féminines`.
bool isYouthTeamCategory(String? category) {
  if (category == null) return false;
  final normalized = category.trim().toLowerCase();
  if (normalized.isEmpty) return false;

  final match = RegExp(r'(?:^|[^a-z0-9])(?:u|m|-)(\d{1,2})(?:[^0-9]|$)')
      .firstMatch(normalized);
  if (match != null) {
    final age = int.tryParse(match.group(1) ?? '');
    if (age != null) return age <= 13;
  }

  // Tennis-like « 11/12 ans »
  final range = RegExp(r'(\d{1,2})\s*/\s*(\d{1,2})\s*ans').firstMatch(normalized);
  if (range != null) {
    final high = int.tryParse(range.group(2) ?? '');
    if (high != null) return high <= 13;
  }

  return false;
}
