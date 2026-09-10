import 'package:viro_team_v2/copy/app_copy.dart';

/// Libellés communs à tous les sports.
List<String> get _commonTail => [
      AppCopy.equipment.catTraining,
      AppCopy.equipment.catHall,
      AppCopy.equipment.catTextile,
    ];

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
        AppCopy.equipment.catBalls,
        AppCopy.equipment.catGoals,
        AppCopy.equipment.catBibs,
        AppCopy.equipment.catProtections,
      ];
    case 'handball':
      specific = [
        AppCopy.equipment.catBalls,
        AppCopy.equipment.catGoals,
        AppCopy.equipment.catBibs,
        AppCopy.equipment.catProtections,
      ];
    case 'basketball':
      specific = [
        AppCopy.equipment.catBalls,
        AppCopy.equipment.catBaskets,
        AppCopy.equipment.catBibs,
        AppCopy.equipment.catProtections,
      ];
    case 'volleyball':
      specific = [
        AppCopy.equipment.catBalls,
        AppCopy.equipment.catNets,
        AppCopy.equipment.catBibs,
        AppCopy.equipment.catProtections,
      ];
    case 'rugby':
      specific = [
        AppCopy.equipment.catBalls,
        AppCopy.equipment.catPosts,
        AppCopy.equipment.catProtections,
      ];
    case 'tennis':
      specific = [
        AppCopy.equipment.catRackets,
        AppCopy.equipment.catTennisBalls,
        AppCopy.equipment.catNets,
      ];
    case 'natation':
      specific = [
        AppCopy.equipment.catPool,
        AppCopy.equipment.catFins,
        AppCopy.equipment.catGoggles,
      ];
    case 'judo':
      specific = [
        AppCopy.equipment.catMats,
        AppCopy.equipment.catBelts,
        AppCopy.equipment.catProtections,
      ];
    case 'escrime':
      specific = [
        AppCopy.equipment.catWeapons,
        AppCopy.equipment.catMasks,
        AppCopy.equipment.catGloves,
      ];
    case 'aviron':
      specific = [
        AppCopy.equipment.catBoats,
        AppCopy.equipment.catOars,
      ];
    case 'athletisme':
      specific = [
        AppCopy.equipment.catHarness,
        AppCopy.equipment.catJump,
        AppCopy.equipment.catThrow,
        AppCopy.equipment.catProtections,
      ];
    default:
      specific = [
        AppCopy.equipment.catBalls,
        AppCopy.equipment.catProtections,
      ];
  }
  return [...specific, ..._commonTail];
}
