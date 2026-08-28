import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Tuile affichant un lieu de pratique ajouté.
class PracticeLocationTile extends StatelessWidget {
  const PracticeLocationTile({
    super.key,
    required this.location,
    this.onRemove,
    this.accent,
  });

  final PracticeLocation location;
  final VoidCallback? onRemove;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final iconColor = accent ?? ViroColors.sportCyan;

    return ViroCard(
      elevated: false,
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: ViroIcon(
              ViroIcons.place,
              color: iconColor,
              size: 18,
            ),
          ),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  location.name,
                  style: theme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: ViroColors.primary800,
                  ),
                ),
                if (location.address != null &&
                    location.address!.trim().isNotEmpty)
                  Text(
                    location.address!,
                    style: theme.bodySmall?.copyWith(
                      color: ViroColors.gray600,
                    ),
                  ),
              ],
            ),
          ),
          if (onRemove != null)
            ViroPressable(
              onTap: onRemove,
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.all(ViroSpacing.xs),
                child: ViroIcon(
                  ViroIcons.close,
                  size: 18,
                  color: ViroColors.gray400,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
