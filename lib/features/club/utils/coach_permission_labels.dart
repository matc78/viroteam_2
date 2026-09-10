import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';

/// Libellé FR d’un flag coach (aligné portail).
class CoachPermissionLabel {
  const CoachPermissionLabel({
    required this.label,
    required this.description,
    required this.apply,
  });

  final String label;
  final String description;
  final CoachPermissions Function(CoachPermissions current, bool enabled) apply;
}

/// Liste des droits coach éditables (ordre portail).
final coachPermissionLabels = <CoachPermissionLabel>[
  CoachPermissionLabel(
    label: AppCopy.club.permCreateEventsLabel,
    description: AppCopy.club.permCreateEventsDesc,
    apply: _applyCanCreateEvents,
  ),
  CoachPermissionLabel(
    label: AppCopy.club.permManageRosterLabel,
    description: AppCopy.club.permManageRosterDesc,
    apply: _applyCanManageTeamRoster,
  ),
  CoachPermissionLabel(
    label: AppCopy.club.permInvitePlayersLabel,
    description: AppCopy.club.permInvitePlayersDesc,
    apply: _applyCanInvitePlayers,
  ),
  CoachPermissionLabel(
    label: AppCopy.club.permTakeAttendanceLabel,
    description: AppCopy.club.permTakeAttendanceDesc,
    apply: _applyCanTakeAttendance,
  ),
  CoachPermissionLabel(
    label: AppCopy.club.permViewFeesLabel,
    description: AppCopy.club.permViewFeesDesc,
    apply: _applyCanViewFees,
  ),
  CoachPermissionLabel(
    label: AppCopy.club.permEditLicensesLabel,
    description: AppCopy.club.permEditLicensesDesc,
    apply: _applyCanEditMemberLicenses,
  ),
];

CoachPermissions _applyCanCreateEvents(CoachPermissions current, bool v) =>
    current.copyWith(canCreateEvents: v);

CoachPermissions _applyCanManageTeamRoster(CoachPermissions current, bool v) =>
    current.copyWith(canManageTeamRoster: v);

CoachPermissions _applyCanInvitePlayers(CoachPermissions current, bool v) =>
    current.copyWith(canInvitePlayers: v);

CoachPermissions _applyCanTakeAttendance(CoachPermissions current, bool v) =>
    current.copyWith(canTakeAttendance: v);

CoachPermissions _applyCanViewFees(CoachPermissions current, bool v) =>
    current.copyWith(canViewFees: v);

CoachPermissions _applyCanEditMemberLicenses(
        CoachPermissions current, bool v) =>
    current.copyWith(canEditMemberLicenses: v);
