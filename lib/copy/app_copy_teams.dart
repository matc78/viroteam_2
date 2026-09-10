part of 'app_copy.dart';

/// Équipes, roster, liens messaging.
final class AppCopyTeams {
  const AppCopyTeams();

  String get emptyClub =>
      'Aucune équipe pour l’instant — crée la première.';
  String get noMembers => 'Aucun membre';
  String get coachesSection => 'Coachs';
  String get coachesAndAdmins => 'Coachs et admins';
  String get teamNameLabel => 'Nom de l\'équipe';
  String get noCoachToAdd => 'Aucun coach dispo à ajouter.';
  String get noPlayerToAdd => 'Aucun joueur dispo à ajouter.';
  String searchNoResult(String query) =>
      'Rien trouvé pour « $query ».';

  String get manageTitle => 'Gérer les équipes';
  String get myTeamsTitle => 'Mes équipes';
  String get createTeamFab => 'Créer une équipe';
  String get teamCreated => 'Équipe créée — c’est parti.';
  String get emptyMyTeams =>
      'Tu n\'es encore dans aucune équipe — le coach t\'y mettra bientôt.';
  String get newTeamTitle => 'Nouvelle équipe';
  String get teamNameHint => 'ex : Équipe A';
  String get categoryLabel => 'Catégorie';
  String get addCoachTitle => 'Ajouter un coach';
  String get addPlayerTitle => 'Ajouter un joueur';
  String get clubPlayersSection => 'Joueurs du club';
  String get playersSection => 'Joueurs';
  String get staffCoachesSection => 'Staff / Coachs';
  String get teammatesSection => 'Coéquipiers';

  String get whatsappLinkInvalid =>
      'Utilise un lien WhatsApp complet (https://chat.whatsapp.com/…).';
  String get whatsappLinkOnly => 'Seuls les liens WhatsApp sont acceptés.';
  String get linksUpdated => 'Liens mis à jour';
  String get messagingLinksTitle => 'Liens WhatsApp';
  String get messagingLinksHelper =>
      'Colle les liens d\'invitation des groupes WhatsApp.';
  String get teamGroupLabel => 'Groupe équipe';
  String get parentsGroupLabel => 'Groupe parents';
  String get whatsappLinkHint => 'https://chat.whatsapp.com/…';
  String get invalidLink => 'Lien invalide';
  String get cannotOpenLink => 'Impossible d\'ouvrir le lien';
  String get discussionsHeader => 'DISCUSSIONS';
  String get addWhatsappLinks => 'Ajouter les liens WhatsApp';
  String get pendingSection => 'En attente';
  String get saveFailed => 'Enregistrement impossible.';
}
