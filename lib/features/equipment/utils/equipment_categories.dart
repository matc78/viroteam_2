/// Libellés communs à tous les sports.
const _commonTail = ['Entraînement', 'Salle', 'Textile'];

/// Types de matériel proposés dans le formulaire inventaire.
abstract final class EquipmentCategoryPresets {
  static const String other = '__other__';

  /// Liste de types selon le sport du club (libellés courts pour filtres).
  static List<String> forSport(String sportName) {
    return equipmentCategoriesForSport(sportName);
  }

  /// Valeur initiale du sélecteur à partir d’une catégorie stockée.
  static String presetForStored(String? stored, List<String> labels) {
    final value = stored?.trim() ?? '';
    if (value.isEmpty) return labels.first;
    if (labels.contains(value)) return value;
    return other;
  }

  /// Catégorie enregistrée à partir du preset et d’un libellé libre.
  static String storedValue({
    required String preset,
    required String customLabel,
  }) {
    if (preset == other) return customLabel.trim();
    return preset;
  }

  static bool isOther(String preset) => preset == other;
}

/// Catégories inventaire suggérées selon le sport du club.
List<String> equipmentCategoriesForSport(String sportName) {
  final sport = sportName.toLowerCase().trim().replaceAll('-', '');
  final List<String> specific;
  switch (sport) {
    case 'football':
      specific = [
        'Ballons',
        'Buts',
        'Chasubles',
        'Protections',
      ];
    case 'handball':
      specific = [
        'Ballons',
        'Buts',
        'Chasubles',
        'Protections',
      ];
    case 'basketball':
      specific = [
        'Ballons',
        'Paniers',
        'Chasubles',
        'Protections',
      ];
    case 'volleyball':
      specific = [
        'Ballons',
        'Filets',
        'Chasubles',
        'Protections',
      ];
    case 'rugby':
      specific = [
        'Ballons',
        'Poteaux',
        'Protections',
      ];
    case 'tennis':
      specific = [
        'Raquettes',
        'Balles',
        'Filets',
      ];
    case 'natation':
      specific = [
        'Piscine',
        'Palmes',
        'Lunettes',
      ];
    case 'judo':
      specific = [
        'Tatamis',
        'Ceintures',
        'Protections',
      ];
    case 'escrime':
      specific = [
        'Armes',
        'Masques',
        'Gants',
      ];
    case 'aviron':
      specific = [
        'Embarcations',
        'Rames',
      ];
    case 'athletisme':
      specific = [
        'Harnais',
        'Saut',
        'Lancer',
        'Protections',
      ];
    default:
      specific = [
        'Ballons',
        'Protections',
      ];
  }
  return [...specific, ..._commonTail];
}
