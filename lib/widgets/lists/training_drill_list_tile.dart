import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/whiteboard/viro_whiteboard.dart';

/// Exercice d'une préparation : numéro, titre, durée, début des consignes
/// et miniature du schéma. [dragHandle] (ma préparation) permet de réordonner.
class TrainingDrillListTile extends StatelessWidget {
  const TrainingDrillListTile({
    super.key,
    required this.drill,
    required this.position,
    this.onTap,
    this.dragHandle,
  });

  final TrainingDrill drill;

  /// Rang affiché (1, 2, 3…).
  final int position;
  final VoidCallback? onTap;

  /// Poignée de réordonnancement (absente en lecture seule).
  final Widget? dragHandle;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final title = drill.title.trim().isEmpty
        ? AppCopy.training.untitledDrill
        : drill.title.trim();
    final instructions = drill.instructions.trim();

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        onTap: onTap,
        semanticLabel: AppCopy.training.drillSemantics(title, drill.durationMin),
        padding: const EdgeInsets.all(ViroSpacing.sm + 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: palette.accentSoft,
              child: Text(
                '$position',
                style: theme.labelMedium?.copyWith(
                  color: palette.brandText,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.titleSmall?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (drill.durationMin != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Row(
                        children: [
                          ViroIcon(
                            ViroIcons.clock,
                            size: 14,
                            color: palette.textMuted,
                          ),
                          const SizedBox(width: ViroSpacing.xs),
                          Text(
                            AppCopy.training.drillDuration(drill.durationMin!),
                            style: theme.bodySmall?.copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (instructions.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: ViroSpacing.xs),
                      child: Text(
                        instructions,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (!drill.board.isEmpty) ...[
              const SizedBox(width: ViroSpacing.sm),
              WhiteboardThumbnail(data: drill.board, width: 56),
            ],
            if (dragHandle != null) ...[
              const SizedBox(width: ViroSpacing.xs),
              dragHandle!,
            ],
          ],
        ),
      ),
    );
  }
}
