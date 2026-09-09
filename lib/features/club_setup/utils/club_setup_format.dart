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

  /// Adresse d'un lieu de pratique créé depuis le siège (rue seule).
  ///
  /// Ville et code postal restent sur les champs dédiés du lieu.
  static String headquartersPracticeAddress({required String address}) {
    return address.trim();
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

  /// Type de lieu de pratique habituel pour un sport (libellé legacy).
  static String venueTypeForSport(String sport) {
    return PracticeLocationCategories.label(
      PracticeLocationCategories.defaultForSport(sport),
    );
  }

  /// Nom du lieu quand le siège est réutilisé comme lieu de pratique.
  static String headquartersPracticeName({
    required String sport,
    required String city,
  }) {
    final venue = venueTypeForSport(sport);
    final cityName = city.trim();
    return cityName.isNotEmpty ? '$venue — $cityName' : venue;
  }

  /// Libellé d'un lieu manuel (catégorie + ville).
  static String practiceLocationName({
    required String category,
    required String city,
    String? categoryCustom,
  }) {
    final categoryLabel =
        PracticeLocationCategories.label(category, categoryCustom);
    final cityName = city.trim();
    return cityName.isNotEmpty ? '$categoryLabel — $cityName' : categoryLabel;
  }

  /// Lieu de pratique dérivé du siège (nom + adresse + catégorie).
  static PracticeLocation headquartersPracticeLocation({
    required String sport,
    required String address,
    required String postalCode,
    required String city,
  }) {
    final practiceAddress = headquartersPracticeAddress(address: address);
    final cityName = city.trim();
    return PracticeLocation(
      name: headquartersPracticeName(sport: sport, city: city),
      city: cityName.isEmpty ? null : cityName,
      address: practiceAddress.isEmpty ? null : practiceAddress,
      category: PracticeLocationCategories.defaultForSport(sport),
      linkedToHeadquarters: true,
    );
  }

  /// Indique si deux lieux de pratique représentent le même emplacement.
  ///
  /// Compare les rues normalisées (suffixe legacy « , CP Ville » ignoré).
  static bool isSameLocation(
    PracticeLocation first,
    PracticeLocation second,
  ) {
    return _normalized(first.name) == _normalized(second.name) &&
        _normalized(first.city ?? '') == _normalized(second.city ?? '') &&
        _normalizedStreet(first) == _normalizedStreet(second) &&
        _normalized(first.category ?? '') ==
            _normalized(second.category ?? '') &&
        _normalized(first.categoryCustom ?? '') ==
            _normalized(second.categoryCustom ?? '');
  }

  /// Index du lieu lié au siège via le flag, ou `-1`.
  static int linkedHeadquartersIndex(List<PracticeLocation> locations) {
    return locations.indexWhere((location) => location.linkedToHeadquarters);
  }

  /// Indique si [location] est le lieu généré depuis le siège actuel.
  ///
  /// Accepte les brouillons legacy dont l’adresse inclut encore « , CP Ville ».
  static bool isHeadquartersLocation({
    required String address,
    required String postalCode,
    required String city,
    required String sport,
    required PracticeLocation location,
  }) {
    if (location.linkedToHeadquarters) return true;
    final expected = headquartersPracticeLocation(
      sport: sport,
      address: address,
      postalCode: postalCode,
      city: city,
    );
    if (_normalized(location.name) != _normalized(expected.name)) {
      return false;
    }
    final locationStreet = streetAddressForDisplay(
      address: location.address,
      city: location.city ?? city,
    );
    final expectedStreet = streetAddressForDisplay(
      address: expected.address,
      city: city,
    );
    if (locationStreet.isEmpty || expectedStreet.isEmpty) return false;
    return _normalized(locationStreet) == _normalized(expectedStreet);
  }

  /// Index du lieu siège dans [locations], ou `-1` s'il est absent.
  static int headquartersLocationIndex({
    required String address,
    required String postalCode,
    required String city,
    required String sport,
    required List<PracticeLocation> locations,
  }) {
    return locations.indexWhere(
      (location) => isHeadquartersLocation(
        address: address,
        postalCode: postalCode,
        city: city,
        sport: sport,
        location: location,
      ),
    );
  }

  /// Migre les lieux legacy : pose `linkedToHeadquarters` sur le siège détecté.
  static List<PracticeLocation> migrateLinkedHeadquarters({
    required String address,
    required String postalCode,
    required String city,
    required String sport,
    required List<PracticeLocation> locations,
  }) {
    if (linkedHeadquartersIndex(locations) >= 0) return locations;
    final legacyIndex = headquartersLocationIndex(
      address: address,
      postalCode: postalCode,
      city: city,
      sport: sport,
      locations: locations,
    );
    if (legacyIndex < 0) return locations;
    return [
      for (var index = 0; index < locations.length; index++)
        if (index == legacyIndex)
          locations[index].copyWith(linkedToHeadquarters: true)
        else
          locations[index],
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

  static String _normalized(String value) => value.trim().toLowerCase();

  /// Rue normalisée d’un lieu (retire le suffixe legacy « , CP Ville »).
  static String _normalizedStreet(PracticeLocation location) {
    return _normalized(
      streetAddressForDisplay(
        address: location.address,
        city: location.city ?? '',
      ),
    );
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
