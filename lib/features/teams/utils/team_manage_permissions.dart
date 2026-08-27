import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/models/club_team.dart';

/// Droits sur le roster d'une équipe (admin vs coach de l'équipe).
class TeamManagePermissions {
  const TeamManagePermissions({
    required this.viewerRole,
    required this.currentUid,
    this.coachPermissions = CoachPermissions.defaults,
  });

  final String viewerRole;
  final String? currentUid;
  final CoachPermissions coachPermissions;

  bool get isAdmin => viewerRole == MemberRoles.admin;

  bool get isCoach => viewerRole == MemberRoles.coach;

  bool isCoachOfTeam(ClubTeam team) {
    if (currentUid == null) return false;
    return team.coachIds.contains(currentUid);
  }

  bool canCreateTeam() => isAdmin;

  bool canAddCoach(ClubTeam team) => isAdmin;

  bool canRemoveCoach(ClubTeam team) => isAdmin;

  bool canAddPlayer(ClubTeam team) {
    if (!coachPermissions.allowsManageTeamRoster(
      isAdmin: isAdmin,
      isCoach: isCoach,
    )) {
      return false;
    }
    return isAdmin || isCoachOfTeam(team);
  }

  /// Seul l'admin peut retirer un joueur (le coach peut ajouter, pas enlever).
  bool canRemovePlayer(ClubTeam team) => isAdmin;

  bool canRemovePendingPlayer(ClubTeam team) => isAdmin;
}
