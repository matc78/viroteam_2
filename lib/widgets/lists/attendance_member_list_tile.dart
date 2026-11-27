import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_rate_bar.dart';

/// Joueur (ou coach) du détail d'une équipe : taux de oui, barre, détail des
/// réponses et pastille « Répond peu » ([showLowResponder], joueurs seuls).
class AttendanceMemberListTile extends StatelessWidget {
  const AttendanceMemberListTile({
    super.key,
    required this.member,
    this.showLowResponder = true,
  });

  final MemberAttendance member;
  final bool showLowResponder;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.attendance;
    final counts = member.counts;
    final lowResponder = showLowResponder && member.isLowResponder;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        padding: const EdgeInsets.all(ViroSpacing.sm + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    member.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.titleSmall?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (lowResponder) ...[
                  Text(
                    copy.lowResponder,
                    style: theme.labelSmall?.copyWith(
                      color: palette.warningText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.sm),
                ],
                Text(
                  counts.convoked == 0
                      ? copy.noConvocation
                      : copy.rate(member.rate),
                  style: theme.titleSmall?.copyWith(
                    color: counts.convoked == 0
                        ? palette.textMuted
                        : palette.brandText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            if (counts.convoked > 0) ...[
              const SizedBox(height: ViroSpacing.xs),
              ViroRateBar(rate: member.rate),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                copy.memberCounts(
                  counts.yes,
                  counts.maybe,
                  counts.no,
                  counts.none,
                  counts.convoked,
                ),
                style: theme.bodySmall?.copyWith(color: palette.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
