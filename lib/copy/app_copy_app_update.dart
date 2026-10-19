part of 'app_copy.dart';

/// Écran de mise à jour obligatoire (version minimale `app_config/mobile`).
final class AppCopyAppUpdate {
  const AppCopyAppUpdate();

  String get title => 'Va télécharger l’update !';
  String get body =>
      'Une nouvelle version de ViroTeam est sortie et ta version n’est plus '
      'dans la course. Passe par le store, c’est l’affaire de deux minutes, '
      'et tu reviens direct sur le terrain.';
  String get updateAction => 'Mettre à jour';
  String get storeOpenFailed =>
      'Impossible d’ouvrir le store. Cherche « ViroTeam » directement.';

  /// Rappel discret de la version installée (ex. « Ta version : 2.2.6 »).
  String currentVersion(String version) => 'Ta version : $version';
}
