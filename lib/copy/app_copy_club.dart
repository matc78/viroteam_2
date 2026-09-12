part of 'app_copy.dart';

/// Fiche club, settings, lieux, apparence, permissions.
final class AppCopyClub {
  const AppCopyClub();

  String get noLocations => 'Aucun lieu enregistré';
  String get noLocationsHint =>
      'Aucun lieu pour l’instant. Ajoute le premier ci-dessous.';
  String get noUpcomingEvents =>
      'Rien à venir pour cette fiche.';
  String get noClubsYet =>
      'Aucun club pour l’instant — crée le tien ou rejoins-en un.';
  String get loadProfileError => 'Impossible de charger le profil';
  String get loadClubsError => 'Impossible de charger les clubs';

  String get settingsTitle => 'Paramètres';
  String configureClubIntro(String clubName) =>
      'Configure $clubName : lieux, saison et droits des coachs.';
  String get locationsSectionTitle => 'Lieux du club';
  String get locationsSectionHelper =>
      'Stades, gymnases et autres lieux utilisés au planning.';
  String get manageLocations => 'Gérer les lieux';
  String locationsCount(int count) =>
      '$count lieu${count > 1 ? 'x' : ''}';
  String get seasonEndSectionTitle => 'Fin de saison';
  String get seasonEndHelper =>
      'Date limite pour le planning et les récurrences.';
  String get seasonEndDateLabel => 'Date de fin';
  String seasonEndAfterMax(String dateLabel) =>
      'La fin de saison ne peut pas dépasser le $dateLabel (31 juillet).';
  String get invalidDate => 'Date invalide.';
  String get seasonEndSaved => 'Fin de saison enregistrée';
  String get saveSeasonEnd => 'Enregistrer la fin de saison';
  String get coachRightsSectionTitle => 'Droits coachs';
  String get coachRightsHelper =>
      'Contrôle des actions visibles pour les coachs du club.';
  String get coachRightsSaved => 'Droits coachs enregistrés';
  String get saveCoachRights => 'Enregistrer les droits coachs';

  String get permCreateEventsLabel => 'Créer des événements';
  String get permCreateEventsDesc =>
      'Le coach peut créer et gérer le planning de ses équipes.';
  String get permManageRosterLabel => 'Gérer le roster';
  String get permManageRosterDesc =>
      'Ajouter des joueurs aux équipes qu’il entraîne.';
  String get permInvitePlayersLabel => 'Inviter des joueurs';
  String get permInvitePlayersDesc =>
      'Créer une fiche membre et envoyer une invitation.';
  String get permTakeAttendanceLabel => 'Prendre les présences';
  String get permTakeAttendanceDesc =>
      'Pointer après la séance pour les stats (optionnel — le RSVP reste prioritaire).';
  String get permViewFeesLabel => 'Voir les cotisations';
  String get permViewFeesDesc =>
      'Accès lecture au suivi des cotisations du club.';
  String get permEditLicensesLabel => 'Modifier les licences';
  String get permEditLicensesDesc =>
      'Éditer le numéro de licence des joueurs.';

  String get locationsScreenTitle => 'Lieux du club';
  String get locationsRegisteredTitle => 'Lieux enregistrés';
  String get locationsRegisteredHelper =>
      'Utilisés pour le planning, les matchs et le lieu de RDV.';
  String get addLocationSectionTitle => 'Ajouter un lieu';
  String get locationTypeLabel => 'Type de lieu';
  String get specifyLabel => 'Préciser';
  String get specifyLocationHint => 'Terrain synthétique…';
  String get addLocationButton => 'Ajouter le lieu';
  String get locationAdded => 'Lieu ajouté';
  String get locationDeleted => 'Lieu supprimé';
  String get deleteLocationConfirm => 'Supprimer ce lieu ?';

  String get appearanceTitle => 'Apparence du club';
  String get logoSection => 'Logo';
  String get editLogo => 'Modifier le logo';
  String get changeLogo => 'Changer le logo';
  String get clubColorSection => 'Couleur du club';
  String get clubColorHelper =>
      'Utilisée sur la page club, le planning et les cartes.';
  String get appearanceSaved => 'Apparence enregistrée';
  String get solidColors => 'Couleurs unies';
  String get bicolorColors => 'Bicolores';
  String get bicolorHelper =>
      'Choisis une 2e couleur en plus de la couleur unie. '
      'Re-clique pour la retirer. '
      'Gauche : accès membre. Droite : gestion du club.';
  String get preview => 'Aperçu';
  String get previewQuickAccessSubtitle => 'Planning, équipes…';
  String get previewManagementSubtitle => 'Membres, équipes, apparence…';
  String get singleColorAllSections =>
      'Couleur unique sur toutes les sections.';

  String get quickAccessSection => 'Accès rapides';
  String get clubManagementSection => 'Gestion du club';
  String get nextEventSection => 'Prochain événement';
  String get toRespondSection => 'À répondre';
  String get announcementsSection => 'Annonces';
  String get rsvpFailed => 'RSVP impossible, réessaie';
  String familyFeeBanner(String label) => 'Cotisation de $label';
  String remainingDue(String amountLabel) => 'Reste dû : $amountLabel';
  String get familyAudienceMe => 'Moi';

  String get statResponses30d => 'Réponses (30 j)';
  String get statRsvpPositive => 'Réponses positives';
  String get statPitchAttendance => 'Présence terrain';
  String get statPitchAttendanceSubtitle => 'Appels sur 30 j';
  String get statNextEvent => 'Prochain event';
  String get statMembers => 'Membres';

  String get actionPlanning => 'Planning';
  String get actionMyTeams => 'Équipes';
  String get actionTeams => 'Équipes';
  String get actionAnnouncements => 'Annonces';
  String get actionMyFee => 'Ma cotisation';
  String get actionPortal => 'Espace club';
  String get actionFee => 'Cotisation';
  String get actionInfos => 'Infos';
  String get actionManageTeams => 'Gérer les équipes';
  String get actionManageMembers => 'Gérer les membres';
  String get actionRecentActivity => 'Dernières actions';
  String get actionFeesTracking => 'Suivi cotisations';
  String get actionAppearance => 'Apparence';
  String get actionEquipment => 'Équipements';
  String get actionLocations => 'Lieux';
  String get actionSettings => 'Paramètres';

  String get myClubsTitle => 'Mes clubs';
  String myClubsCount(int count) => 'Mes clubs ($count)';
  String pendingInvitesCount(int count) =>
      'Invitations en attente ($count)';
  String get createOrJoinClub => 'Créer ou rejoindre un club';
  String get emptyClubsTitle =>
      'Tu n\'es encore dans aucun club';
  String get emptyClubsBody =>
      'Rejoins un club existant ou crée le tien pour démarrer.';
  String get addClubSheetTitle => 'Ajouter un club';
  String get addClubSheetBody =>
      'Crée un nouveau club ou rejoins-en un avec un code.';
  String get createClubOption => 'Créer un club';
  String get createClubOptionSubtitle =>
      'Deviens admin d\'un nouveau club';
  String get joinWithCodeOption => 'Rejoindre avec un code';
  String get joinWithCodeSubtitle =>
      'Code fourni par ton entraîneur ou admin';
  String get memberSingular => 'membre';
  String get memberPlural => 'membres';
  String get aClubFallback => 'Un club';
  String followChildNamed(String firstName) => 'Suivre $firstName';
  String get followChildGeneric => 'Suivre un enfant du club';
  String roleColon(String role) => 'Rôle : $role';
  String get declineInvite => 'Refuser';
  String get acceptInvite => 'Accepter';
  String clubInvitedYou(String clubName) => '$clubName t\'a invité';
  String get openAddressTitle => 'Ouvrir l\'adresse';
  String get cannotOpenMaps =>
      'Impossible d\'ouvrir l\'application de navigation';
}
