part of 'app_copy.dart';

/// Annonces club.
final class AppCopyAnnouncements {
  const AppCopyAnnouncements();

  String get empty =>
      'Aucune annonce pour l’instant — le vestiaire est calme.';
  String get noTeamsInClub => 'Aucune équipe dans ce club.';
  String get noCategories => 'Aucune catégorie dispo.';

  String get screenTitle => 'Annonces';
  String get newAnnouncementFab => 'Nouvelle annonce';
  String get newAnnouncementTitle => 'Nouvelle annonce';
  String get editAnnouncementTitle => 'Modifier l\'annonce';
  String get messageLabel => 'Message';
  String get messageHint => 'Ton message important…';
  String get deadlineLabel => 'Date limite';
  String get recipientsLabel => 'Destinataires';
  String get publish => 'Publier';
  String get announceUpdated => 'Annonce mise à jour.';
  String get announcePublished => 'Annonce publiée — c’est parti.';
  String get announceClosed => 'Annonce clôturée.';
  String get announceDeleted => 'Annonce supprimée.';
  String get closeConfirmTitle => 'Clôturer l\'annonce ?';
  String get closeConfirmBody =>
      'Elle ne sera plus visible pour les destinataires, mais restera dans l\'historique.';
  String get closeAction => 'Clôturer';
  String get deleteConfirmTitle => 'Supprimer l\'annonce ?';
  String get deleteConfirmBody =>
      'Cette annonce sera définitivement supprimée pour tous les membres.';
  String get closedSuffix => ' · Clôturée';
  String get closedBadge => 'Clôturée';
  String untilDate(String dateLabel) => 'Jusqu’au $dateLabel';
  String get messageRequired => 'Saisis un message.';
  String get deadlineMustBeFuture =>
      'La date limite doit être dans le futur.';
  String get targetRequired =>
      'Sélectionne au moins une cible.';
  String get broadcastAllMembersHint =>
      'L\'annonce sera diffusée à tous les membres du club.';
  String get hideFailed => 'Impossible de masquer l\'annonce.';

  String get targetAllMembers => 'Tous les membres';
  String get targetTeams => 'Équipes';
  String get targetCategories => 'Catégories';
  String get targetPeople => 'Personnes';
}
