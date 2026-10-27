import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Tuile d’action staff (coach / admin) teintée aux couleurs du club.
class ClubManagementListTile extends StatelessWidget {
  const ClubManagementListTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final style = ClubAccentStyle(accentColor);
    final readable = palette.readableAccent(accentColor);
    final radius = BorderRadius.circular(ViroSpacing.cardRadius);

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroPressable(
        onTap: onTap,
        borderRadius: radius,
        label: '$title, $subtitle',
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: palette.surfaceCard,
            borderRadius: radius,
            border: Border.all(color: style.border),
            boxShadow:
                ViroMotion.accentBorderTileShadow(palette, style.border),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.md - 2,
              vertical: ViroSpacing.sm + 2,
            ),
            child: Row(
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: style.iconFill,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(ViroSpacing.sm),
                    child: ViroIcon(icon, size: 20, color: readable),
                  ),
                ),
                const SizedBox(width: ViroSpacing.md - 2),
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
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: ViroSpacing.sm),
                ViroIcon(
                  ViroIcons.chevronRight,
                  size: 18,
                  color: readable,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
