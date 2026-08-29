/// Options de libellé saison (ex. `2024-2025`), aligné portail web.
List<String> buildSeasonLabelOptions([int? aroundYear]) {
  final year = aroundYear ?? DateTime.now().year;
  final start = year - 1;
  return List.generate(4, (index) {
    final from = start + index;
    return '$from-${from + 1}';
  });
}

/// Libellé par défaut pour une nouvelle saison (2e option du portail).
String defaultSeasonLabel([int? aroundYear]) {
  final options = buildSeasonLabelOptions(aroundYear);
  if (options.length > 1) return options[1];
  return options.first;
}
