part of 'app_copy.dart';

/// Droits club : catalogue, fonctions, attribution et refus d'accès.
///
/// Pas d'humour sur le droit Administrateur ni sur les refus (voix sobre).
final class AppCopyPermissions {
  const AppCopyPermissions();

  // ——— Refus d'accès (garde d'écran) ———

  String get accessDeniedTitle => 'Accès réservé';
  String get accessDenied => 'Tu n’as pas les droits pour ouvrir cette page.';
  String get accessDeniedHint =>
      'Un admin du club peut te les donner depuis ta fiche membre.';
  String get backToClub => 'Retour au club';

  // ——— Feuille d'attribution ———

  String get manageRights => 'Gérer les droits';

  /// Libellé de la ligne « droits » en lecture seule (non-admin).
  String get rightsReadOnlyLabel => 'Droits';
  String rightsOf(String name) => 'Droits de $name';
  String get rightsIntro =>
      'Deux niveaux : les capacités sur ses équipes (si entraîneur), puis '
      'les droits à l’échelle du club.';
  String get teamCapabilitiesSection => 'Capacités d’équipe';
  String get teamCapabilitiesHelper =>
      'Valables seulement sur les équipes qu’il entraîne. Les mêmes pour '
      'tous les coachs — ça se règle dans Paramètres du club.';
  String get teamCapabilitiesEmpty =>
      'Pas encore coach d’une équipe — nomme-le coach dans l’équipe pour '
      'lui donner ces capacités.';
  String coachedTeamsLabel(String teams) => 'Équipes : $teams';
  String get coachRightsRedirectTitle => 'Modifier les capacités des coachs ?';
  String get coachRightsRedirectBody =>
      'Elles valent pour tous les coachs du club et se règlent dans les '
      'paramètres du club. On y va ?';
  /// Variante si la feuille a des droits club non enregistrés.
  String get coachRightsRedirectBodyUnsaved =>
      'Elles valent pour tous les coachs du club et se règlent dans les '
      'paramètres du club. Les droits non enregistrés de cette feuille '
      'seront perdus. On y va ?';
  String get coachRightsRedirectGo => 'Go';
  String get coachRightsRedirectNo => 'Non';
  String get clubRightsSection => 'Droits club';
  String get functionsSection => 'Raccourcis';
  String get functionsHelper =>
      'Un raccourci coche plusieurs droits club d’un coup (Responsable…). '
      'S’ils sont déjà attribués, le raccourci apparaît coché.';
  String get detailSection => 'Détail des droits';
  String get detailHelper =>
      'Chaque droit individuellement. Les cases suivent aussi les raccourcis '
      'cochés plus haut.';
  String get adminSection => 'Administration';
  String get adminWarning =>
      'L’administrateur a tous les droits, y compris celui d’attribuer des '
      'droits aux autres membres. Le club garde toujours au moins un admin.';
  String get save => 'Enregistrer';
  String get rightsUpdated => 'Droits mis à jour.';
  String get rightsUpdateFailed => 'Impossible de mettre à jour les droits.';
  String get cannotChangeOwnRights =>
      'Tu ne peux pas modifier tes propres droits — un autre admin doit le faire.';
  String get noRights => 'Aucun droit particulier';
  String get noClubRights => 'aucun droit club';
  String rightsCount(int count) =>
      count <= 1 ? '$count droit' : '$count droits';
  String clubRightsCount(int count) =>
      count <= 1 ? '$count droit club' : '$count droits club';
  String get allRights => 'Tous les droits';
  String get functionPartial => 'En partie';

  /// Préfixe du résumé pour un coach d'équipe (« Entraîneur · … »).
  String get coachSummaryPrefix => 'Entraîneur';

  /// Mention d'un droit coché d'office par un autre droit coché.
  String impliedBy(ClubPermission permission) =>
      'Inclus avec « ${permissionLabel(permission)} ».';

  /// Résumé affiché sur la fiche (« Entraîneur · 1 droit club », …).
  String rightsSummary({
    required bool isAdmin,
    required int permissionCount,
    required bool isTeamCoach,
  }) {
    if (isAdmin) return allRights;
    if (isTeamCoach) {
      final club = permissionCount == 0
          ? noClubRights
          : clubRightsCount(permissionCount);
      return '$coachSummaryPrefix · $club';
    }
    if (permissionCount == 0) return noRights;
    return rightsCount(permissionCount);
  }

  // ——— Raccourcis (fonctions prédéfinies) ———

  /// Nom d'un raccourci de droits.
  String functionLabel(ClubFunction function) => switch (function) {
    ClubFunction.feesManager => 'Responsable cotisations',
    ClubFunction.announcementsManager => 'Responsable annonces',
    ClubFunction.membersManager => 'Responsable membres',
    ClubFunction.sportsManager => 'Responsable sportif',
    ClubFunction.equipmentManager => 'Responsable matériel',
  };

  /// Description d'un raccourci de droits.
  String functionDescription(ClubFunction function) => switch (function) {
    ClubFunction.feesManager =>
      'Saisons, encaissements, aides et suivi des cotisations.',
    ClubFunction.announcementsManager =>
      'Annonces à l’échelle de tout le club.',
    ClubFunction.membersManager => 'Membres, invitations, parents et équipes.',
    ClubFunction.sportsManager =>
      'Planning de toutes les équipes et gestion des effectifs.',
    ClubFunction.equipmentManager => 'Inventaire du matériel du club.',
  };

  // ——— Droits ———

  /// Nom d'un droit club.
  String permissionLabel(ClubPermission permission) => switch (permission) {
    ClubPermission.admin => 'Administrateur',
    ClubPermission.manageMembers => 'Gérer les membres',
    ClubPermission.manageTeams => 'Gérer les équipes',
    ClubPermission.manageEvents => 'Gérer le planning',
    ClubPermission.manageAnnouncements => 'Gérer les annonces',
    ClubPermission.manageFees => 'Gérer les cotisations',
    ClubPermission.viewFees => 'Voir les cotisations',
    ClubPermission.manageClubSettings => 'Gérer les infos du club',
    ClubPermission.manageEquipment => 'Gérer le matériel',
    ClubPermission.manageChat => 'Gérer la messagerie',
    ClubPermission.viewActivity => 'Voir le journal d’activité',
  };

  /// Description d'un droit club.
  String permissionDescription(ClubPermission permission) =>
      switch (permission) {
        ClubPermission.admin =>
          'Tous les droits, y compris attribuer des droits.',
        ClubPermission.manageMembers =>
          'Ajouter, inviter, modifier et retirer des membres, liens parents.',
        ClubPermission.manageTeams =>
          'Créer et supprimer des équipes, nommer les coachs, gérer les '
              'effectifs.',
        ClubPermission.manageEvents =>
          'Événements, convocations, appel et réponses de toutes les équipes.',
        ClubPermission.manageAnnouncements =>
          'Publier, modifier et supprimer les annonces de tout le club.',
        ClubPermission.manageFees =>
          'Saisons, encaissements, aides et exonérations (inclut la lecture).',
        ClubPermission.viewFees =>
          'Suivre les cotisations, sans rien modifier.',
        ClubPermission.manageClubSettings =>
          'Identité, apparence, lieux et saison.',
        ClubPermission.manageEquipment => 'Inventaire du matériel.',
        ClubPermission.manageChat =>
          'Créer des canaux et écrire dans les canaux réservés.',
        ClubPermission.viewActivity =>
          'Consulter le journal d’activité du club.',
      };
}
