import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/services/training/training_library.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Séance passée de la bibliothèque : jour et équipes, coach, nombre
/// d'exercices et minutage, enchaînement des exercices ; boutons Consulter
/// et Dupliquer ([duplicated] : déjà dupliquée dans la séance en cours).
class TrainingLibrarySessionListTile extends StatelessWidget {
  const TrainingLibrarySessionListTile({
    super.key,
    required this.session,
    required this.teamsLabel,
    required this.onOpen,
    this.onDuplicate,
    this.duplicated = false,
  });

  final TrainingLibrarySession session;

  /// Équipes de la séance (« M18, Seniors »), vide si inconnues.
  final String teamsLabel;
  final VoidCallback onOpen;

  /// Absent : consultation seule.
  final VoidCallback? onDuplicate;
  final bool duplicated;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final date = session.event.date;
    final day =
        '${formatWeekdayShort(date)} ${date.day} ${formatMonthShort(date)}';
    final teams = teamsLabel.isEmpty
        ? AppCopy.training.libraryDefaultTeams
        : teamsLabel;
    final sequence = [
      for (var i = 0; i < session.drills.length; i++)
        session.drills[i].title.trim().isEmpty
            ? AppCopy.training.untitledDrill(i + 1)
            : session.drills[i].title.trim(),
    ].join(' → ');

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        padding: const EdgeInsets.all(ViroSpacing.sm + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$day · $teams',
              style: theme.titleSmall?.copyWith(
                color: palette.brandText,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              AppCopy.training.librarySessionMeta(
                AppCopy.training.libraryCoach(session.coachName),
                session.drills.length,
                plannedMinutes(session.drills),
              ),
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
            if (sequence.isNotEmpty) ...[
              const SizedBox(height: ViroSpacing.xs),
              Text(
                sequence,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: theme.bodySmall?.copyWith(color: palette.textPrimary),
              ),
            ],
            const SizedBox(height: ViroSpacing.sm),
            Wrap(
              spacing: ViroSpacing.sm,
              runSpacing: ViroSpacing.xs,
              alignment: WrapAlignment.end,
              children: [
                TextButton(
                  onPressed: onOpen,
                  child: Text(AppCopy.training.libraryOpenSession),
                ),
                if (onDuplicate != null)
                  ElevatedButton(
                    onPressed: duplicated ? null : onDuplicate,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(0, ViroSpacing.buttonHeightSmall),
                    ),
                    child: Text(
                      duplicated
                          ? AppCopy.training.libraryDuplicated
                          : AppCopy.training.libraryDuplicate,
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
