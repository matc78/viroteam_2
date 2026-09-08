/// Catégories de lieux de pratique (wizard + persistance, aligné portail).
abstract final class PracticeLocationCategories {
  static const String cityStade = 'city_stade';
  static const String stadium = 'stadium';
  static const String gymnasium = 'gymnasium';
  static const String athleticsTrack = 'athletics_track';
  static const String healthTrail = 'health_trail';
  static const String forest = 'forest';
  static const String lake = 'lake';
  static const String pool = 'pool';
  static const String dojo = 'dojo';
  static const String tennisCourt = 'tennis_court';
  static const String fencingHall = 'fencing_hall';
  static const String nauticalBase = 'nautical_base';
  static const String other = 'other';

  static const List<String> all = [
    cityStade,
    stadium,
    gymnasium,
    athleticsTrack,
    healthTrail,
    forest,
    lake,
    pool,
    dojo,
    tennisCourt,
    fencingHall,
    nauticalBase,
    other,
  ];

  static const Map<String, String> labels = {
    cityStade: 'City-stade',
    stadium: 'Stade',
    gymnasium: 'Gymnase',
    athleticsTrack: "Piste d'athlétisme",
    healthTrail: 'Parcours santé',
    forest: 'Forêt',
    lake: 'Lac',
    pool: 'Piscine',
    dojo: 'Dojo',
    tennisCourt: 'Court de tennis',
    fencingHall: "Salle d'armes",
    nauticalBase: 'Base nautique',
    other: 'Autre',
  };

  /// Catégories proposées selon le sport du club (+ Autre toujours).
  static List<String> forSport(String sport) {
    List<String> withOther(List<String> categories) => [...categories, other];

    switch (sport) {
      case 'Football':
      case 'Rugby':
        return withOther([stadium, cityStade, gymnasium, forest, healthTrail]);
      case 'Basketball':
      case 'Handball':
      case 'Volleyball':
        return withOther([cityStade, gymnasium, stadium, forest, healthTrail]);
      case 'Athlétisme':
        return withOther([athleticsTrack, stadium, healthTrail, forest]);
      case 'Natation':
        return withOther([pool, lake]);
      case 'Tennis':
        return withOther([tennisCourt, gymnasium]);
      case 'Judo':
        return withOther([dojo, gymnasium]);
      case 'Escrime':
        return withOther([fencingHall, gymnasium]);
      case 'Aviron':
        return withOther([nauticalBase, lake]);
      default:
        return List<String>.from(all);
    }
  }

  /// Catégorie proposée selon le sport du club.
  static String defaultForSport(String sport) {
    final categories = forSport(sport);
    return categories.isEmpty ? other : categories.first;
  }

  /// Libellé affiché ; [customLabel] si catégorie `other`.
  static String label(String category, [String? customLabel]) {
    if (category == other && (customLabel?.trim().isNotEmpty ?? false)) {
      return customLabel!.trim();
    }
    return labels[category] ?? customLabel?.trim() ?? labels[other]!;
  }

  /// Indique si [category] fait partie du catalogue connu.
  static bool isKnown(String category) => all.contains(category);
}
