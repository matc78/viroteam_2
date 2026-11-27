import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_permission.dart';

/// Libellé FR d’une capacité coach (aligné portail).
class CoachPermissionLabel {
  const CoachPermissionLabel({
    required this.flag,
    required this.label,
    required this.description,
  });

  final CoachFlag flag;
  final String label;
  final String description;
}

/// Capacités coach affichées (ordre du catalogue, aligné portail).
List<CoachPermissionLabel> get coachPermissionLabels => [
  for (final flag in CoachFlag.values)
    CoachPermissionLabel(
      flag: flag,
      label: _label(flag),
      description: _description(flag),
    ),
];

String _label(CoachFlag flag) => switch (flag) {
      CoachFlag.canCreateEvents => AppCopy.club.permCreateEventsLabel,
      CoachFlag.canManageTeamRoster => AppCopy.club.permManageRosterLabel,
      CoachFlag.canInvitePlayers => AppCopy.club.permInvitePlayersLabel,
      CoachFlag.canPublishTeamAnnouncements =>
        AppCopy.club.permPublishTeamAnnouncementsLabel,
      CoachFlag.canEditMemberLicenses => AppCopy.club.permEditLicensesLabel,
      CoachFlag.canEditMemberRsvp => AppCopy.club.permEditMemberRsvpLabel,
    };

String _description(CoachFlag flag) => switch (flag) {
      CoachFlag.canCreateEvents => AppCopy.club.permCreateEventsDesc,
      CoachFlag.canManageTeamRoster => AppCopy.club.permManageRosterDesc,
      CoachFlag.canInvitePlayers => AppCopy.club.permInvitePlayersDesc,
      CoachFlag.canPublishTeamAnnouncements =>
        AppCopy.club.permPublishTeamAnnouncementsDesc,
      CoachFlag.canEditMemberLicenses => AppCopy.club.permEditLicensesDesc,
      CoachFlag.canEditMemberRsvp => AppCopy.club.permEditMemberRsvpDesc,
    };
