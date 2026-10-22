import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';

/// En-tête de jour pour le planning global (regroupement par date).
class PlanningDaySectionHeader extends StatelessWidget {
  const PlanningDaySectionHeader({
    super.key,
    required this.day,
    this.compactTop = false,
    this.muted = false,
    this.accentColor,
  });

  final DateTime day;
  final bool compactTop;

  /// Style grisé pour un jour sans événement (vue semaine).
  final bool muted;

  /// Couleur club pour le badge « Aujourd'hui » / « Demain ».
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final parts = planningDayHeaderParts(day);
    final theme = Theme.of(context).textTheme;
    final badgeColor = accentColor ?? palette.accentFill;
    final weekdayColor = muted ? palette.textMuted : palette.brandText;
    final separatorColor = muted ? palette.borderStrong : palette.accentMid;
    final dateColor = muted ? palette.textMuted : palette.accent;
    final underlineColor = muted ? palette.borderStrong : palette.accent;

    final titleStyle = muted ? theme.titleMedium : theme.titleLarge;

    return Padding(
      padding: EdgeInsets.only(
        top: compactTop || muted ? ViroSpacing.xs : ViroSpacing.md,
        bottom: muted ? ViroSpacing.xs : ViroSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                parts.weekday,
                style: titleStyle?.copyWith(
                  color: weekdayColor,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.xs),
                child: Text(
                  '·',
                  style: titleStyle?.copyWith(
                    color: separatorColor,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
              Text(
                '${parts.day} ${parts.month}',
                style: titleStyle?.copyWith(
                  color: dateColor,
                  shadows: muted ? null : palette.neonGlow(dateColor),
                  fontWeight: FontWeight.w600,
                  height: 1.1,
                ),
              ),
              if (parts.dayOffsetLabel != null) ...[
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    parts.dayOffsetLabel!,
                    style: theme.labelSmall?.copyWith(
                      color: palette.textMuted,
                      fontWeight: FontWeight.w400,
                      height: 1,
                    ),
                  ),
                ),
              ],
              if (parts.badge != null) ...[
                const SizedBox(width: ViroSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.sm,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: badgeColor,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    parts.badge!,
                    style: theme.labelSmall?.copyWith(
                      color: ViroColors.white,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: ViroSpacing.xs),
          Container(
            height: 2,
            width: 32,
            decoration: BoxDecoration(
              color: underlineColor,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
        ],
      ),
    );
  }
}
