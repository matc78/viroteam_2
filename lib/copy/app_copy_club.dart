part of 'app_copy.dart';

/// Fiche club, settings, lieux, apparence, permissions.
final class AppCopyClub {
  const AppCopyClub();

  String get noLocations => 'Aucun lieu enregistré';
  String get noLocationsHint =>
      'Aucun lieu pour l’instant. Ajoute le premier ci-dessous.';
  String get noUpcomingEvents =>
      'Rien à venir pour cette fiche.';
  String noUpcomingForChild(String firstName) =>
      'Rien à venir pour $firstName.';
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
  String get coachRightsSectionTitle => 'Droits coachs';
  String get coachRightsHelper =>
      'Contrôle des actions visibles pour les coachs du club. '
      'Les changements s’appliquent à l’enregistrement.';
  String get settingsSaved => 'Paramètres du club enregistrés';
  String get settingsSaveFailed => 'Enregistrement impossible, réessaie.';
  String get saveSettings => 'Enregistrer les modifications';
  String get settingsUpToDate => 'Tout est enregistré';
  String get settingsAdminOnly =>
      'Seuls les admins du club peuvent modifier ces paramètres.';
  String get backToClub => 'Retour au club';
  String get discardChangesTitle => 'Quitter sans enregistrer ?';
  String get discardChangesBody => 'Tes modifications seront perdues.';
  String get discardChangesAction => 'Quitter';

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
  String get locationNameLabel => 'Nom du lieu';
  String get locationNameHint => 'Ex. Gymnase des Bertisettes';
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

  /// Titre de la zone staff sur la fiche club, selon le rôle du membre.
  String clubStaffSection(String role) =>
      role == MemberRoles.admin ? 'Côté admin' : 'Côté coach';

  String get nextEventSection => 'Prochain événement';
  String get toRespondSection => 'À répondre';
  String get announcementsSection => 'Annonces';
  String get rsvpFailed => 'RSVP impossible, réessaie';
  String familyFeeBanner(String label) => 'Cotisation de $label';
  String remainingDue(String amountLabel) => 'Reste dû : $amountLabel';
  String get familyAudienceMe => 'Moi';

  /// Sous-titre header fiche club en vue parent.
  String familyFollowingChild(String firstName) =>
      'Tu suis la fiche de $firstName';

  /// Bannière sous le header : rappelle le mode parent.
  String get familyAccessHint =>
      'Planning, convocations et cotisation — tu gères pour ton enfant.';


  String get actionPlanning => 'Planning';
  String get actionMyTeams => 'Équipes';
  String get actionAnnouncements => 'Annonces';
  String get actionMyFee => 'Ma cotisation';
  String get actionFee => 'Cotisation';
  String get actionInfos => 'Infos';
  String get actionManageMembers => 'Gérer les membres';
  String get actionRecentActivity => 'Dernières actions';
  String get actionFeesTracking => 'Suivi cotisations';
  String get actionAppearance => 'Apparence';
  String get actionEquipment => 'Équipements';
  String get actionLocations => 'Lieux';
  String get actionSettings => 'Paramètres';

  String get todoSection => 'À faire';
  String get shortcutsSection => 'Ton club';
  String get noUpcomingEvent => 'Rien de prévu pour l’instant. Repos !';
  String weekEventsCount(int count) => switch (count) {
        0 => 'Rien cette semaine',
        1 => '1 événement cette semaine',
        _ => '$count événements cette semaine',
      };
  String get noTeamYet => 'Pas encore d’équipe';
  String teamsSummary(List<String> names) => names.length <= 2
      ? names.join(', ')
      : '${names.take(2).join(', ')} +${names.length - 2}';
  String get feeUpToDate => 'À jour';
  String feeRemaining(String amountLabel) => '$amountLabel restants';
  String get feeNotSet => 'Pas de cotisation en cours';
  String get announcementsNone => 'Aucune annonce en cours';
  String feeDueTodo(String amountLabel) =>
      'Cotisation : $amountLabel à régler';
  String get loadingShort => '…';

  String get managementPeopleGroup => 'Membres et activité';
  String get managementClubGroup => 'Club';
  String membersCount(int count) =>
      count <= 1 ? '$count membre' : '$count membres';
  String membersWithPending(int count, int pending) =>
      '${membersCount(count)} · $pending en attente';
  String get activitySubtitle => 'Qui a fait quoi récemment';
  String get feesTrackingSubtitle => 'Saison, paiements et relances';
  String get appearanceSubtitle => 'Logo et couleurs du club';
  String get locationsSubtitle => 'Terrains et salles';
  String get equipmentSubtitle => 'Matériel du club';
  String get settingsSubtitle => 'Droits des coachs, infos du club';
  String roleRequestsTodo(int count) => count <= 1
      ? '1 demande de rôle à regarder'
      : '$count demandes de rôle à regarder';
  String get roleRequestsTodoHint => 'Rien d’urgent, un tap par demande.';
  String get roleRequestsTitle => 'Demandes de rôle';
  String get roleRequestsIntro =>
      'Des membres aimeraient changer de rôle. Pas d’urgence : accepte ou '
      'refuse quand tu as deux minutes, le rôle s’applique tout seul.';
  String get roleRequestsEmpty => 'Rien à traiter, tu peux souffler.';
  String roleRequestAsk(String roleLabel, String currentRoleLabel) =>
      'Souhaite passer $roleLabel (aujourd’hui $currentRoleLabel)';
  String get roleRequestAccept => 'Accepter';
  String get roleRequestRefuse => 'Refuser';
  String roleRequestAccepted(String name) => 'C’est fait, $name a son nouveau rôle.';
  String roleRequestRefused(String name) => 'Demande de $name refusée.';
  String get roleRequestRefuseTitle => 'Refuser la demande ?';
  String roleRequestRefuseBody(String name) =>
      '$name garde son rôle actuel et pourra refaire une demande plus tard.';
  String get roleRequestFailed => 'Impossible de traiter la demande, réessaie.';
  String get roleRequestsLoadError => 'Impossible de charger les demandes';
  String get roleRequestFallbackName => 'Un membre';
  String heroAttendance(int percent) => '$percent % de oui';
  String heroPitchAttendance(int percent) => '$percent % présents (appel)';
  String heroTeams(int count) => count <= 1 ? '$count équipe' : '$count équipes';

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
