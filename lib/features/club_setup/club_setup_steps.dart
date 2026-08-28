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
