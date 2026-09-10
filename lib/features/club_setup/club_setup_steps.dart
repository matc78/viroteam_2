import 'package:viro_team_v2/copy/app_copy.dart';

/// Indices et libellés des étapes du wizard création club.
abstract final class ClubSetupSteps {
  static const int wizardVersion = 3;

  static const int prerequisites = 0;
  static const int identity = 1;
  static const int objectives = 2;
  static const int memberCount = 3;
  static const int headquarters = 4;
  static const int practiceLocations = 5;
  static const int recap = 6;

  static const int total = 7;

  static List<String> get labels => AppCopy.clubSetup.stepLabels;

  static const List<String> analyticsKeys = [
    'prerequisites',
    'identity',
    'objectives',
    'member_count',
    'headquarters',
    'practice_locations',
    'recap',
  ];

  /// Clé analytics snake_case de l'étape [step] (bornée aux indices valides).
  static String analyticsKey(int step) => analyticsKeys[clampIndex(step)];

  /// Ramène [step] dans `[0, total)`.
  static int clampIndex(int step) {
    if (step < 0) return 0;
    if (step >= total) return total - 1;
    return step;
  }

  /// Ramène un index sauvegardé (v1 / v2) vers les indices du wizard courant.
  static int normalizePersistedStep(int step, {required int wizardVersion}) {
    if (wizardVersion >= ClubSetupSteps.wizardVersion) {
      return clampIndex(step);
    }

    final v2Step = wizardVersion >= 2
        ? step.clamp(0, 4)
        : _normalizeV1ToV2(step);

    return switch (v2Step) {
      0 => prerequisites,
      1 => identity,
      2 => objectives,
      3 => headquarters,
      4 => recap,
      _ => clampIndex(v2Step),
    };
  }

  /// Ancien wizard v1 (6 étapes, « Bienvenue » en 0) → indices v2.
  static int _normalizeV1ToV2(int step) {
    if (step <= prerequisites) return prerequisites;
    if (step == 1) return identity;
    return (step - 1).clamp(identity, 4);
  }
}
