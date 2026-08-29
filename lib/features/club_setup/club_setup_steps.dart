/// Indices et libellés des étapes du wizard création club.
abstract final class ClubSetupSteps {
  static const int wizardVersion = 2;

  static const int prerequisites = 0;
  static const int identity = 1;
  static const int objectives = 2;
  static const int location = 3;
  static const int recap = 4;

  static const int total = 5;

  static const List<String> labels = [
    'Prérequis',
    'Identité',
    'Objectifs',
    'Localisation',
    'Récap',
  ];

  static const List<String> analyticsKeys = [
    'prerequisites',
    'identity',
    'objectives',
    'location',
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

  /// Ramène un index sauvegardé avec l'ancien wizard (6 étapes, « Bienvenue »).
  static int normalizePersistedStep(int step, {required int wizardVersion}) {
    final clamped = step.clamp(0, total - 1);
    if (wizardVersion >= ClubSetupSteps.wizardVersion) {
      return clamped;
    }
    if (step <= prerequisites) return prerequisites;
    if (step == 1) return identity;
    return (step - 1).clamp(identity, recap);
  }
}
