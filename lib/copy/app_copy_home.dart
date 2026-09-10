part of 'app_copy.dart';

/// Home membre / quiet content.
final class AppCopyHome {
  const AppCopyHome();

  String greeting(String? firstName) {
    final hour = DateTime.now().hour;
    final salutation = hour < 18 ? 'Salut' : 'Bonsoir';
    final trimmed = firstName?.trim();
    if (trimmed != null && trimmed.isNotEmpty) {
      return '$salutation, $trimmed';
    }
    return salutation;
  }

  String get quietSubtitle =>
      'Terrain libre — rien au planning pour l’instant. Profite-en pour récupérer.';
  String get yourClub => 'Ton club';
  String get yourClubs => 'Tes clubs';
  String get loadClubsError => 'Impossible de charger tes clubs';
  String get loadPlanningError => 'Impossible de charger le planning';

  String get emptyPlanningTitle => 'Terrain libre pour l\'instant';
  String get emptyPlanningBody =>
      'Dès qu\'un entraînement ou un match est posé dans tes clubs, '
      'il atterrit ici tout seul.';

  String get upcomingPlanningTitle => 'Planning à venir';
  String get seeAllPlanning => 'Voir mes 14 prochains jours';
  String get addClub => 'Ajouter un club';
  String get createOrJoinClub => 'Créer ou rejoindre un club';
  String get joinClubForPlanning =>
      'Rejoins un club pour voir ton planning';

  String get rsvpFailed => 'RSVP impossible, réessaie';
  String get rsvpAbsent => 'Absent';
  String get rsvpPresent => 'Présent';
  String get rsvpMaybe => 'Peut-être';
  String get rsvpNo => 'Non';
  String get rsvpYes => 'Oui';
}
