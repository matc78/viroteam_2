import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/training/training_library.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/whiteboard/viro_whiteboard.dart';

/// Exercice de la bibliothèque : miniature du schéma, titre et durée,
/// consignes, séance d'origine (jour · coach) ; bouton Ajouter ([added] :
/// déjà ajouté à la séance en cours).
class TrainingLibraryDrillListTile extends StatelessWidget {
  const TrainingLibraryDrillListTile({
    super.key,
    required this.row,
    required this.onAdd,
    this.added = false,
  });

  final TrainingLibraryDrillRow row;
  final VoidCallback onAdd;
  final bool added;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final drill = row.drill;
    final date = row.session.event.date;
    final title = drill.title.trim().isEmpty
        ? AppCopy.training.libraryUntitledDrill
        : drill.title.trim();
    final duration = drill.durationMin == null
        ? ''
        : ' · ${AppCopy.training.drillDuration(drill.durationMin!)}';
    final instructions = drill.instructions.trim();
    final preview = drill.previewBoard;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        padding: const EdgeInsets.all(ViroSpacing.sm + 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (preview != null && !preview.isEmpty) ...[
              WhiteboardThumbnail(data: preview, width: 72),
              const SizedBox(width: ViroSpacing.sm),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$title$duration',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.titleSmall?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (instructions.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      instructions,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodySmall?.copyWith(
                        color: palette.textPrimary,
                      ),
                    ),
                  ],
                  const SizedBox(height: 2),
                  Text(
                    '${formatWeekdayShort(date)} ${date.day} '
                    '${formatMonthShort(date)} · '
                    '${AppCopy.training.libraryCoach(row.session.coachName)}',
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                  const SizedBox(height: ViroSpacing.sm),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton(
                      onPressed: added ? null : onAdd,
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(
                          0,
                          ViroSpacing.buttonHeightSmall,
                        ),
                      ),
                      child: Text(
                        added
                            ? AppCopy.training.libraryDrillAdded
                            : AppCopy.training.libraryAddDrill,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
