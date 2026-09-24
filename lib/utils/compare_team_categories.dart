import 'package:viro_team_v2/utils/team_categories.dart';

/// Compare deux libellés de catégorie (M7 avant M21, U9 avant U11…).
int compareTeamCategories(String a, String b) {
  final left = _parseCategorySortKey(a);
  final right = _parseCategorySortKey(b);
  final prefixCmp = left.prefix.compareTo(right.prefix);
  if (prefixCmp != 0) return prefixCmp;
  if (left.age != null && right.age != null && left.age != right.age) {
    return left.age!.compareTo(right.age!);
  }
  if (left.age != null && right.age == null) return -1;
  if (left.age == null && right.age != null) return 1;
  return a.toLowerCase().compareTo(b.toLowerCase());
}

/// Trie les catégories ; si [sport] est fourni, privilégie l’ordre catalogue sport.
List<String> sortTeamCategories(
  Iterable<String> categories, {
  String? sport,
}) {
  final unique = categories
      .map((c) => c.trim())
      .where((c) => c.isNotEmpty)
      .toSet()
      .toList();
  if (sport != null && sport.trim().isNotEmpty) {
    final catalog = teamCategoriesForSport(sport);
    final rank = <String, int>{
      for (var i = 0; i < catalog.length; i++) catalog[i]: i,
    };
    unique.sort((a, b) {
      final ra = rank[a];
      final rb = rank[b];
      if (ra != null && rb != null) return ra.compareTo(rb);
      if (ra != null) return -1;
      if (rb != null) return 1;
      return compareTeamCategories(a, b);
    });
    return unique;
  }
  unique.sort(compareTeamCategories);
  return unique;
}

({String prefix, int? age}) _parseCategorySortKey(String raw) {
  final value = raw.trim();
  var digitStart = -1;
  for (var i = 0; i < value.length; i++) {
    final code = value.codeUnitAt(i);
    if (code >= 48 && code <= 57) {
      digitStart = i;
      break;
    }
  }
  if (digitStart < 0) {
    return (prefix: value.toLowerCase(), age: null);
  }
  var digitEnd = digitStart;
  while (digitEnd < value.length) {
    final code = value.codeUnitAt(digitEnd);
    if (code < 48 || code > 57) break;
    digitEnd++;
  }
  return (
    prefix: value.substring(0, digitStart).toLowerCase(),
    age: int.tryParse(value.substring(digitStart, digitEnd)),
  );
}
