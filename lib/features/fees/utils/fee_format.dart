import 'package:intl/intl.dart';

/// Formate un montant en centimes en euros (locale FR).
String formatFeeAmountCents(int amountCents) {
  final euros = amountCents / 100;
  return NumberFormat.currency(
    locale: 'fr_FR',
    symbol: '€',
    decimalDigits: 2,
  ).format(euros);
}

/// Parse une saisie utilisateur (ex. "180" ou "180,50") en centimes.
int? parseAmountToCents(String input) {
  final trimmed = input.trim().replaceAll(' ', '').replaceAll('€', '');
  if (trimmed.isEmpty) return null;
  final normalized = trimmed.replaceAll(',', '.');
  final value = double.tryParse(normalized);
  if (value == null || value < 0) return null;
  return (value * 100).round();
}

/// Libellés de saison scolaire / sportive (année N–N+1) autour de [aroundYear].
List<String> feeSeasonLabelOptions([DateTime? around]) {
  final year = (around ?? DateTime.now()).year;
  final start = year - 1;
  return List.generate(4, (index) {
    final from = start + index;
    return '$from-${from + 1}';
  });
}

/// Options de saison : liste standard + [current] s'il est hors liste (legacy).
List<String> feeSeasonLabelChoices(String? current, [DateTime? around]) {
  final options = feeSeasonLabelOptions(around);
  if (current == null || current.isEmpty || options.contains(current)) {
    return options;
  }
  return [current, ...options];
}

/// Choisit un libellé valide parmi [feeSeasonLabelChoices], sinon la saison courante.
String resolveFeeSeasonLabel(String? current, [DateTime? around]) {
  final options = feeSeasonLabelChoices(current, around);
  if (current != null && options.contains(current)) return current;
  final year = (around ?? DateTime.now()).year;
  final preferred = '$year-${year + 1}';
  if (options.contains(preferred)) return preferred;
  return options.first;
}
