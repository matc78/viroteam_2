import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_objectives_ui.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Puce sélectionnable pour un objectif club (wizard création).
class ObjectiveChip extends StatelessWidget {
  const ObjectiveChip({
    super.key,
    required this.objectiveKey,
    required this.selected,
    required this.onToggle,
  });

  final String objectiveKey;
  final bool selected;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final icon = clubObjectiveIcon(objectiveKey);
    final accent = ClubSetupUi.objectiveAccent(objectiveKey);

    return ViroPressable(
      onTap: onToggle,
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: ViroMotion.fast,
        curve: ViroMotion.enter,
        padding: const EdgeInsets.fromLTRB(8, 6, 10, 6),
        decoration: BoxDecoration(
          color: selected
              ? accent.withValues(alpha: 0.12)
              : ViroColors.surfaceCard,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? accent : ViroColors.primary100,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ViroIcon(
              icon,
              size: 15,
              color: selected ? accent : ViroColors.gray400,
            ),
            const SizedBox(width: 6),
            Text(
              ClubObjectives.label(objectiveKey),
              style: theme.labelSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: selected ? accent : ViroColors.primary800,
                height: 1.1,
              ),
            ),
            if (selected) ...[
              const SizedBox(width: 5),
              ViroIcon(ViroIcons.check, size: 12, color: accent),
            ],
          ],
        ),
      ),
    );
  }
}
