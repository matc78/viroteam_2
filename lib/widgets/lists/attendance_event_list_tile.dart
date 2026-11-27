import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Événement passé du détail d'une équipe : titre, jour, joueurs (et coachs)
/// ayant répondu oui sur les convoqués, taux de oui joueurs.
class AttendanceEventListTile extends StatelessWidget {
  const AttendanceEventListTile({
    super.key,
    required this.row,
    required this.title,
  });

  final EventAttendance row;

  /// Titre affiché de l'événement (planning).
  final String title;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.attendance;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        padding: const EdgeInsets.all(ViroSpacing.sm + 4),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.titleSmall?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${formatEventDate(row.event.date)} · '
                    '${copy.eventCounts(row.counts.yes, row.counts.convoked, row.coachYes, row.coachConvoked)}',
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Text(
              copy.rate(row.rate),
              style: theme.titleSmall?.copyWith(
                color: palette.brandText,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
