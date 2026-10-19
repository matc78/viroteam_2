import 'package:viro_team_v2/features/club_setup/practice_location_categories.dart';
import 'package:viro_team_v2/models/club.dart';

/// Formatage adresse / lieu pour le wizard création club.
abstract final class ClubSetupFormat {
  /// Ligne d'adresse du siège (récap, affichage).
  static String headquartersLine({
    required String address,
    required String postalCode,
    required String city,
  }) {
    final street = address.trim();
    final postal = postalCode.trim();
    final cityName = city.trim();

    if (street.isNotEmpty) {
      final cityLine =
          [postal, cityName].where((part) => part.isNotEmpty).join(' ');
      if (cityLine.isEmpty) return street;
      return '$street\n$cityLine';
    }
    if (postal.isNotEmpty && cityName.isNotEmpty) return '$postal $cityName';
    if (cityName.isNotEmpty) return cityName;
    return postal;
  }

  /// Rue seule pour l'affichage (retire un suffixe legacy « , CP Ville »).
  static String streetAddressForDisplay({
    required String? address,
    required String city,
  }) {
    var street = address?.trim() ?? '';
    if (street.isEmpty) return '';

    final cityName = city.trim();
    if (cityName.isNotEmpty) {
      final legacySuffix = RegExp(
        ',\\s*(?:\\d{5}\\s+)?${RegExp.escape(cityName)}\\s*\$',
        caseSensitive: false,
      );
      street = street.replaceFirst(legacySuffix, '').trim();
    }

    // Suffixe « , 75001 » seul (sans ville).
    street = street.replaceFirst(RegExp(r',\s*\d{5}\s*$'), '').trim();
    return street;
  }

  /// Écarte les lieux auto-liés au siège (brouillons legacy).
  static List<PracticeLocation> withoutLinkedHeadquarters(
    List<PracticeLocation> locations,
  ) {
    return [
      for (final location in locations)
        if (!location.linkedToHeadquarters) location,
    ];
  }

  /// Résumé court des lieux ajoutés.
  static String practiceLocationsSummary({
    required List<PracticeLocation> locations,
    String? fallbackCity,
  }) {
    if (locations.isEmpty) return '';

    final counts = <String, int>{};
    for (final location in locations) {
      final label = PracticeLocationCategories.label(
        location.category ?? PracticeLocationCategories.other,
        location.categoryCustom,
      );
      final key = label.trim().isEmpty
          ? PracticeLocationCategories.labels[PracticeLocationCategories.other]!
          : label;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    final categoryParts = counts.entries.map((entry) {
      final count = entry.value;
      final label = entry.key;
      if (count > 1) return '$count ${_pluralizeCategoryLabel(label)}';
      return '$count ${label.toLowerCase()}';
    }).toList();

    final cities = {
      for (final location in locations)
        if ((location.city?.trim() ?? '').isNotEmpty) location.city!.trim(),
    }.toList();

    final cityName = cities.length == 1
        ? cities.first
        : cities.isEmpty
            ? (fallbackCity?.trim() ?? '')
            : '';

    final head = categoryParts.join(' · ');
    if (cityName.isNotEmpty) return '$head à $cityName';
    if (cities.length > 1) return '$head · ${cities.join(', ')}';
    return head;
  }

  static String _pluralizeCategoryLabel(String label) {
    final normalized = label.trim().toLowerCase();
    switch (normalized) {
      case 'city-stade':
        return 'city-stades';
      case 'parcours santé':
        return 'parcours santé';
      case "piste d'athlétisme":
        return "pistes d'athlétisme";
      case "salle d'armes":
        return "salles d'armes";
      case 'base nautique':
        return 'bases nautiques';
      case 'court de tennis':
        return 'courts de tennis';
      case 'autre':
        return 'autres';
      default:
        if (normalized.endsWith('s') || normalized.endsWith('x')) {
          return normalized;
        }
        return '${normalized}s';
    }
  }
}
