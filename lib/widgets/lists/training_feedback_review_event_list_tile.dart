import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Entraînement d'une équipe que je n'entraîne pas, avec des retours
/// envoyés (page Feedback, consultation admin). Un tap ouvre les retours.
class TrainingFeedbackReviewEventListTile extends StatelessWidget {
  const TrainingFeedbackReviewEventListTile({
    super.key,
    required this.title,
    required this.dateLabel,
    required this.feedbackCount,
    this.teamLabel,
    this.onTap,
  });

  final String title;

  /// Date lisible (« sam. 21/11 »).
  final String dateLabel;

  /// Nombre de coachs ayant envoyé leur retour.
  final int feedbackCount;
  final String? teamLabel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final subtitle = [dateLabel, ?teamLabel].join(' · ');

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        onTap: onTap,
        semanticLabel: AppCopy.training.reviewTileSemantics(
          title,
          dateLabel,
          feedbackCount,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm + 2,
        ),
        child: Row(
          children: [
            ViroIcon(ViroIcons.eye, size: 20, color: palette.textSecondary),
            const SizedBox(width: ViroSpacing.md),
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
                      fontWeight: FontWeight.w600,
                    ),
                  ),
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
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.sm,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: palette.accentSofter,
                borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
              ),
              child: Text(
                AppCopy.training.reviewCount(feedbackCount),
                style: theme.labelSmall?.copyWith(
                  color: palette.brandText,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: ViroSpacing.xs),
            ViroIcon(
              ViroIcons.chevronRight,
              size: 18,
              color: palette.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}
