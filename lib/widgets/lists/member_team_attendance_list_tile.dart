import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/widgets/common/viro_rate_bar.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Présences de saison d'un membre dans une équipe (fiche membre) : nom,
/// badge(s) de rôle, taux de oui avec barre, convocations, entraînements et
/// matchs. [row] est le bilan de l'équipe réduite au membre.
class MemberTeamAttendanceListTile extends StatelessWidget {
  const MemberTeamAttendanceListTile({
    super.key,
    required this.row,
    required this.roles,
    this.categoryColor,
  });

  final TeamAttendance row;

  /// Badges roster dans l'équipe (entraîneur, joueur / sparring).
  final List<ViroRole> roles;

  /// Couleur de la catégorie de l'équipe (pastille), si connue.
  final Color? categoryColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.attendance;
    final roleLabels = [
      for (final role in roles) RoleBadgeVisual.labelFor(role),
    ].join(', ');

    return Semantics(
      container: true,
      label: copy.memberSemantics(
        row.team.name,
        roleLabels,
        row.rate,
        row.totals.yes,
        row.totals.convoked,
      ),
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: ViroSpacing.xs),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (categoryColor != null) ...[
                  Container(
                    width: ViroSpacing.sm,
                    height: ViroSpacing.sm,
                    decoration: BoxDecoration(
                      color: categoryColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.sm),
                ],
                Expanded(
                  child: Text(
                    row.team.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.bodyMedium?.copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                for (final role in roles) ...[
                  const SizedBox(width: ViroSpacing.xs),
                  ViroRoleBadge(role: role, compact: true, iconOnly: true),
                ],
                const SizedBox(width: ViroSpacing.sm),
                Text(
                  copy.memberYes(row.rate),
                  style: theme.bodyMedium?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.xs),
            ViroRateBar(rate: row.rate),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              '${copy.memberYesOf(row.totals.yes, row.totals.convoked)} · '
              '${copy.memberTrainingMatch(
                trainingYes: row.training.yes,
                trainingConvoked: row.training.convoked,
                matchYes: row.match.yes,
                matchConvoked: row.match.convoked,
              )}',
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
