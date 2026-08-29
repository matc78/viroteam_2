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

  /// Adresse d'un lieu de pratique créé depuis le siège.
  static String headquartersPracticeAddress({
    required String address,
    required String postalCode,
    required String city,
  }) {
    final street = address.trim();
    final postal = postalCode.trim();
    final cityName = city.trim();

    if (street.isNotEmpty) {
      return [
        street,
        [postal, cityName].where((part) => part.isNotEmpty).join(' '),
      ].where((part) => part.isNotEmpty).join(', ');
    }
    if (postal.isNotEmpty && cityName.isNotEmpty) return '$postal $cityName';
    return cityName.isNotEmpty ? cityName : postal;
  }

  /// Type de lieu de pratique habituel pour un sport.
  static String venueTypeForSport(String sport) {
    return switch (sport) {
      'Football' || 'Rugby' || 'Athlétisme' => 'Stade',
      'Basketball' || 'Volleyball' || 'Handball' => 'Gymnase',
      'Tennis' => 'Court',
      'Natation' => 'Piscine',
      'Judo' => 'Dojo',
      'Escrime' => 'Salle d\'armes',
      'Aviron' => 'Base nautique',
      _ => 'Gymnase',
    };
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

  /// Lieu de pratique dérivé du siège (nom + adresse).
  static PracticeLocation headquartersPracticeLocation({
    required String sport,
    required String address,
    required String postalCode,
    required String city,
  }) {
    final practiceAddress = headquartersPracticeAddress(
      address: address,
      postalCode: postalCode,
      city: city,
    );
    return PracticeLocation(
      name: headquartersPracticeName(sport: sport, city: city),
      address: practiceAddress.isEmpty ? null : practiceAddress,
    );
  }

  /// Indique si deux lieux de pratique représentent le même emplacement.
  static bool isSameLocation(
    PracticeLocation first,
    PracticeLocation second,
  ) {
    return _normalized(first.name) == _normalized(second.name) &&
        _normalized(first.address ?? '') == _normalized(second.address ?? '');
  }

  /// Indique si [location] est le lieu généré depuis le siège actuel.
  static bool isHeadquartersLocation({
    required String address,
    required String postalCode,
    required String city,
    required String sport,
    required PracticeLocation location,
  }) {
    return isSameLocation(
      location,
      headquartersPracticeLocation(
        sport: sport,
        address: address,
        postalCode: postalCode,
        city: city,
      ),
    );
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

  static String _normalized(String value) => value.trim().toLowerCase();
}
