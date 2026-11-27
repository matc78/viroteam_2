import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_permission.dart';

/// Droits effectifs du compte connecté dans un club : point d'entrée unique
/// du contrôle d'accès côté app (jamais de comparaison de rôle ailleurs).
///
/// Deux sources, et seulement deux :
/// - les **droits** de sa fiche (`members/{uid}.permissions`), valables pour
///   tout le club ; le droit `admin` les implique tous ;
/// - la relation **coach d'équipe** (`members/{uid}.coachTeamIds`), qui donne
///   des capacités sur ses équipes, réglées par `clubs.coachPermissions`.
///
/// Les règles Firestore et les Cloud Functions appliquent les mêmes
/// conditions : ce modèle ne sert qu'à afficher ou masquer.
class ClubAccess {
  const ClubAccess({
    required this.permissions,
    required this.coachTeamIds,
    required this.teamIds,
    this.coachPermissions = CoachPermissions.defaults,
  });

  /// Aucun droit : compte sans fiche dans le club (parent seul, chargement).
  static const ClubAccess none = ClubAccess(
    permissions: {},
    coachTeamIds: [],
    teamIds: [],
  );

  /// Droits de [member] dans [club]. Fiche absente → [none].
  factory ClubAccess.of({required ClubMember? member, required Club? club}) {
    if (member == null) return none;
    return ClubAccess(
      permissions: member.permissions,
      coachTeamIds: member.coachTeamIds,
      teamIds: member.teamIds,
      coachPermissions: club?.coachPermissions ?? CoachPermissions.defaults,
    );
  }

  /// Droits stockés sur la fiche.
  final Set<ClubPermission> permissions;

  /// Équipes entraînées.
  final List<String> coachTeamIds;

  /// Équipes de la fiche (joueur ou coach).
  final List<String> teamIds;

  /// Capacités que le club accorde à ses coachs d'équipe.
  final CoachPermissions coachPermissions;

  /// Droit Administrateur : implique tous les autres, seul à en attribuer.
  bool get isAdmin => permissions.contains(ClubPermission.admin);

  /// `true` si la fiche accorde [permission] (`admin` accorde tout).
  bool can(ClubPermission permission) =>
      isAdmin || permissions.contains(permission);

  /// Coach d'au moins une équipe.
  bool get isTeamCoach => coachTeamIds.isNotEmpty;

  bool coachesTeam(String teamId) => coachTeamIds.contains(teamId);

  /// Coach d'au moins une des [teamIds].
  bool coachesAnyTeam(Iterable<String> teamIds) => teamIds.any(coachesTeam);

  /// [teamIds] non vide et toutes entraînées par le compte.
  bool coachesAllTeams(Iterable<String> teamIds) =>
      teamIds.isNotEmpty && teamIds.every(coachesTeam);

  /// Coach d'équipe et capacité [flag] accordée par le club.
  bool coachCan(CoachFlag flag) => isTeamCoach && coachPermissions.allows(flag);

  /// Encadrement du club : au moins un droit, ou coach d'équipe. Ouvre la
  /// zone de gestion (dont chaque entrée reste soumise à son propre droit).
  bool get isStaff => permissions.isNotEmpty || isTeamCoach;

  // ——— Membres ———

  /// Ouvre « Gérer les membres » : droit membres ou équipes, capacité
  /// d'inviter, ou coach d'équipe (qui y voit ses effectifs).
  bool get canOpenMembers =>
      canAddMembers ||
      can(ClubPermission.manageMembers) ||
      can(ClubPermission.manageTeams) ||
      isTeamCoach;

  /// Ajouter / inviter un membre (fiche pré-créée + invitation).
  bool get canAddMembers =>
      can(ClubPermission.manageMembers) || coachCan(CoachFlag.canInvitePlayers);

  /// Modifier la licence d'un membre des équipes [memberTeamIds].
  bool canEditMemberLicense(Iterable<String> memberTeamIds) =>
      can(ClubPermission.manageMembers) ||
      (coachCan(CoachFlag.canEditMemberLicenses) &&
          coachesAnyTeam(memberTeamIds));

  // ——— Équipes ———

  /// Ajouter un joueur à l'équipe [teamId] (le retrait exige `manageTeams`).
  bool canAddPlayerToTeam(String teamId) =>
      can(ClubPermission.manageTeams) ||
      (coachesTeam(teamId) && coachCan(CoachFlag.canManageTeamRoster));

  /// Partager le code d'invitation de l'équipe [teamId].
  bool canShareTeamInvite(String teamId) =>
      can(ClubPermission.manageMembers) ||
      (coachesTeam(teamId) && coachCan(CoachFlag.canInvitePlayers));

  // ——— Événements ———

  /// Peut créer un événement pour au moins une équipe (bouton d'ajout).
  bool get canCreateEvents =>
      can(ClubPermission.manageEvents) || coachCan(CoachFlag.canCreateEvents);

  /// Modifier / annuler un événement : coach de toutes ses équipes, hors
  /// « tout le club » ([allTeams]).
  bool canManageEvent(Iterable<String> teamIds, {required bool allTeams}) =>
      can(ClubPermission.manageEvents) ||
      (!allTeams &&
          coachCan(CoachFlag.canCreateEvents) &&
          coachesAllTeams(teamIds));

  /// Convocations / notification : même portée que [canManageEvent], sans
  /// capacité requise.
  bool canManageEventAudience(
    Iterable<String> teamIds, {
    required bool allTeams,
  }) =>
      can(ClubPermission.manageEvents) ||
      (!allTeams && coachesAllTeams(teamIds));

  /// RSVP d'un autre membre : coach d'une des équipes, hors « tout le club ».
  bool canEditMemberRsvp(Iterable<String> teamIds, {required bool allTeams}) =>
      can(ClubPermission.manageEvents) ||
      (!allTeams &&
          coachCan(CoachFlag.canEditMemberRsvp) &&
          coachesAnyTeam(teamIds));

  // ——— Outils d'entraînement ———

  /// Préparer une séance / faire un retour : coach d'une des équipes, hors
  /// « tout le club ». L'admin non coach ne fait que consulter.
  bool canCoachTraining(Iterable<String> teamIds, {required bool allTeams}) =>
      !allTeams && coachesAnyTeam(teamIds);

  /// Consulter les préparations et les retours envoyés : coachs de la
  /// séance et admin (lecture seule pour l'admin non coach).
  bool canReviewTraining(Iterable<String> teamIds, {required bool allTeams}) =>
      canCoachTraining(teamIds, allTeams: allTeams) || isAdmin;

  // ——— Annonces ———

  /// Peut publier une annonce (au club, ou seulement à ses équipes).
  bool get canPublishAnnouncements =>
      can(ClubPermission.manageAnnouncements) ||
      coachCan(CoachFlag.canPublishTeamAnnouncements);

  /// Publier / modifier une annonce ciblant uniquement les équipes [teamIds].
  bool canPublishAnnouncementToTeams(Iterable<String> teamIds) =>
      can(ClubPermission.manageAnnouncements) ||
      (coachCan(CoachFlag.canPublishTeamAnnouncements) &&
          coachesAllTeams(teamIds));

  // ——— Messagerie ———

  /// Écrire dans un canal réservé aux coachs et responsables.
  bool get canWriteStaffChannels =>
      can(ClubPermission.manageChat) || isTeamCoach;
}
