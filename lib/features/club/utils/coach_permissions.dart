import 'package:viro_team_v2/models/club_permission.dart';

/// Capacités des coachs d'équipe, réglées pour tout le club sur
/// `clubs/{clubId}.coachPermissions`. Elles ne valent que pour les équipes
/// qu'un coach entraîne (voir `ClubAccess`).
class CoachPermissions {
  const CoachPermissions([this._overrides = const {}]);

  /// Valeurs explicites ; un flag absent prend sa valeur par défaut.
  final Map<CoachFlag, bool> _overrides;

  /// Valeurs par défaut si la map est absente (clubs existants).
  static const CoachPermissions defaults = CoachPermissions();

  /// Parse la map Firestore ; clés absentes ou invalides → défaut.
  factory CoachPermissions.fromMap(Map<String, dynamic>? map) {
    if (map == null) return defaults;
    return CoachPermissions({
      for (final flag in CoachFlag.values)
        if (map[flag.id] case final bool value) flag: value,
    });
  }

  /// `true` si le club accorde [flag] à ses coachs d'équipe.
  bool allows(CoachFlag flag) => _overrides[flag] ?? flag.defaultValue;

  /// Copie avec [flag] réglé sur [enabled].
  CoachPermissions withFlag(CoachFlag flag, bool enabled) =>
      CoachPermissions({..._overrides, flag: enabled});

  /// Payload Firestore pour `clubs/{clubId}.coachPermissions`.
  Map<String, bool> toMap() => {
        for (final flag in CoachFlag.values) flag.id: allows(flag),
      };

  @override
  bool operator ==(Object other) =>
      other is CoachPermissions &&
      CoachFlag.values.every((flag) => allows(flag) == other.allows(flag));

  @override
  int get hashCode =>
      Object.hashAll([for (final flag in CoachFlag.values) allows(flag)]);
}
