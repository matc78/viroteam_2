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
      final cityLine = [postal, cityName].where((part) => part.isNotEmpty).join(' ');
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

  /// Nom du lieu quand le siège est réutilisé comme lieu de pratique.
  static String headquartersPracticeName(String city) {
    final cityName = city.trim();
    return cityName.isNotEmpty ? 'Siège — $cityName' : 'Siège du club';
  }
}
