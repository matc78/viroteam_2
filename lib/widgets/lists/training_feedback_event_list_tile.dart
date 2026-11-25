import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Entraînement passé dans la liste « Feedback entraînement » : date,
/// équipe et statut de mon retour (À faire / Envoyé / Flemme). L'appui long
/// ([onLongPress]) bascule la « flemme ».
class TrainingFeedbackEventListTile extends StatelessWidget {
  const TrainingFeedbackEventListTile({
    super.key,
    required this.title,
    required this.dateLabel,
    required this.status,
    this.teamLabel,
    this.onTap,
    this.onLongPress,
    this.attachedBelow = false,
  });

  /// Des retours de collègues suivent juste en dessous : marge réduite pour
  /// les coller à cette séance.
  final bool attachedBelow;

  /// Titre de l'entraînement.
  final String title;

  /// Date lisible (« mardi 25 novembre »).
  final String dateLabel;

  /// Équipe(s) concernée(s), si connues.
  final String? teamLabel;

  /// Statut de mon retour.
  final TrainingFeedbackStatus status;
  final VoidCallback? onTap;

  /// Bascule « flemme » (absent une fois le retour envoyé).
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final (badgeFill, badgeText) = switch (status) {
      TrainingFeedbackStatus.sent => (
          ViroColors.success.withValues(alpha: 0.14),
          palette.successText,
        ),
      TrainingFeedbackStatus.todo => (
          ViroColors.warning.withValues(alpha: 0.14),
          palette.warningText,
        ),
      TrainingFeedbackStatus.skipped => (
          palette.surfaceMuted,
          palette.textSecondary,
        ),
    };
    final subtitle = [dateLabel, ?teamLabel].join(' · ');

    return Padding(
      padding: EdgeInsets.only(
        bottom: attachedBelow ? ViroSpacing.xs : ViroSpacing.sm,
      ),
      child: ViroCard(
        onTap: onTap,
        onLongPress: onLongPress,
        semanticLabel: AppCopy.training.eventSemantics(
          title: title,
          date: dateLabel,
          status: status,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm + 2,
        ),
        child: Row(
          children: [
            ViroIcon(ViroIcons.whistle, size: 20, color: palette.accent),
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
                color: badgeFill,
                borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
              ),
              child: Text(
                AppCopy.training.statusLabel(status),
                style: theme.labelSmall?.copyWith(
                  color: badgeText,
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
