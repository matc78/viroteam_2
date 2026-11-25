import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/features/training/widgets/training_feedback_summary_card.dart';

/// Bloc « Retour du coach » de la fiche d'un entraînement passé, pour le
/// joueur ou son parent : retours collectifs + message perso de [memberId].
/// Rien n'est affiché tant qu'aucun coach n'a envoyé son retour.
class TrainingFeedbackReceivedCard extends ConsumerWidget {
  const TrainingFeedbackReceivedCard({
    super.key,
    required this.clubId,
    required this.eventId,
    required this.memberId,
    this.childFirstName,
    this.showTitle = true,
  });

  /// Intitulé « Retour du coach » en tête (masqué quand l'écran le porte).
  final bool showTitle;

  final String clubId;
  final String eventId;

  /// Fiche du joueur concerné (soi ou enfant sélectionné).
  final String memberId;

  /// Prénom de l'enfant quand un parent lit (« Pour Inès »).
  final String? childFirstName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final received = ref.watch(
      trainingReceivedProvider((
        clubId: clubId,
        eventId: eventId,
        memberId: memberId,
      )),
    );
    if (received.feedbacks.isEmpty) return const SizedBox.shrink();

    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final messageByCoach = {
      for (final m in received.messages) m.coachUid: m.message,
    };
    final child = childFirstName?.trim();
    final personalLabel = child == null || child.isEmpty
        ? AppCopy.training.receivedPersonal
        : AppCopy.training.receivedPersonalFor(child);

    return Padding(
      padding: const EdgeInsets.only(top: ViroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showTitle) ...[
            Row(
              children: [
                ViroIcon(ViroIcons.feedback, size: 18, color: palette.accent),
                const SizedBox(width: ViroSpacing.xs),
                Text(
                  AppCopy.training.receivedTitle,
                  style: theme.titleSmall?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
          ],
          for (final feedback in received.feedbacks)
            Padding(
              padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
              child: TrainingFeedbackSummaryCard(
                feedback: feedback,
                personalMessage: messageByCoach[feedback.coachUid],
                personalLabel: personalLabel,
              ),
            ),
        ],
      ),
    );
  }
}
