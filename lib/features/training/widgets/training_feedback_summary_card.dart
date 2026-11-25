import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/training/widgets/training_rating_row.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Retour collectif d'un coach : ses deux notes, son mot au collectif et,
/// si fourni, le message perso adressé au lecteur ([personalMessage]).
class TrainingFeedbackSummaryCard extends StatelessWidget {
  const TrainingFeedbackSummaryCard({
    super.key,
    required this.feedback,
    this.personalMessage,
    this.personalLabel,
    this.footer,
  });

  final TrainingFeedback feedback;

  /// Message perso du coach au joueur qui lit (soi ou enfant).
  final String? personalMessage;

  /// Intitulé du message perso (« Pour toi », « Pour Inès »).
  final String? personalLabel;

  /// Contenu ajouté en bas de carte (messages perso côté consultation).
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final collective = feedback.collectiveMessage;
    final personal = personalMessage?.trim();

    return ViroCard(
      elevated: false,
      padding: const EdgeInsets.all(ViroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ViroIcon(ViroIcons.roleCoach, size: 16, color: palette.accent),
              const SizedBox(width: ViroSpacing.xs),
              Expanded(
                child: Text(
                  AppCopy.training.reviewCoach(feedback.coachName),
                  style: theme.titleSmall?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          TrainingRatingRow(
            label: AppCopy.training.levelLabel,
            value: feedback.levelRating,
          ),
          TrainingRatingRow(
            label: AppCopy.training.engagementLabel,
            value: feedback.engagementRating,
          ),
          if (collective != null) ...[
            const SizedBox(height: ViroSpacing.sm),
            Text(
              collective,
              style: theme.bodyMedium?.copyWith(color: palette.textPrimary),
            ),
          ],
          if (personal != null && personal.isNotEmpty) ...[
            const SizedBox(height: ViroSpacing.sm),
            Container(
              padding: const EdgeInsets.all(ViroSpacing.sm),
              decoration: BoxDecoration(
                color: palette.accentSofter,
                borderRadius: BorderRadius.circular(ViroSpacing.sm),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    personalLabel ?? AppCopy.training.receivedPersonal,
                    style: theme.labelMedium?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    personal,
                    style: theme.bodyMedium?.copyWith(
                      color: palette.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ],
          ?footer,
        ],
      ),
    );
  }
}
