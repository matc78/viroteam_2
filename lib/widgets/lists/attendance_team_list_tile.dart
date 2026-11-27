import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_rate_bar.dart';

/// Équipe de la page Présences : oui joueurs (barre), entraînements et
/// matchs, événements et part de réponses, pastille « à relancer ».
class AttendanceTeamListTile extends StatelessWidget {
  const AttendanceTeamListTile({
    super.key,
    required this.row,
    required this.onTap,
    this.categoryColor,
  });

  final TeamAttendance row;
  final VoidCallback onTap;

  /// Couleur de la catégorie de l'équipe (pastille), si connue.
  final Color? categoryColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.attendance;
    final toRemind = row.lowResponders.length;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        onTap: onTap,
        semanticLabel: copy.teamSemantics(row.team.name, row.rate, toRemind),
        padding: const EdgeInsets.all(ViroSpacing.sm + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (categoryColor != null) ...[
                  Container(
                    width: ViroSpacing.sm + 2,
                    height: ViroSpacing.sm + 2,
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
                    style: theme.titleSmall?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  copy.rate(row.rate),
                  style: theme.titleMedium?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: ViroSpacing.xs),
                ViroIcon(
                  ViroIcons.chevronRight,
                  size: 16,
                  color: palette.textMuted,
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            ViroRateBar(rate: row.rate),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              copy.teamTrainingMatch(row.trainingRate, row.matchRate),
              style: theme.bodySmall?.copyWith(color: palette.textPrimary),
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                Expanded(
                  child: Text(
                    copy.teamMeta(row.eventCount, row.allResponseRate),
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ),
                if (toRemind > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ViroSpacing.sm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: palette.surfaceSubtle,
                      borderRadius: BorderRadius.circular(
                        ViroSpacing.buttonRadius,
                      ),
                    ),
                    child: Text(
                      copy.toRemindBadge(toRemind),
                      style: theme.labelSmall?.copyWith(
                        color: palette.warningText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
