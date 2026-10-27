part of 'app_copy.dart';

/// Écran « Mes clubs » (sélecteur de club + invitations en attente).
final class AppCopyClubs {
  const AppCopyClubs();

  String get declineConfirmTitle => 'Refuser l’invitation ?';

  /// Corps de la confirmation de refus pour le club [clubName].
  String declineConfirmBody(String clubName) =>
      'Tu ne rejoindras pas $clubName. Il faudra une nouvelle invitation '
      'pour changer d’avis.';

  /// Libellé lecteur d’écran de la carte du club [clubName].
  String openClubLabel(String clubName) => 'Ouvrir le club $clubName';
}
