import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Retour envoyé par un autre coach, affiché en retrait juste sous
/// l'entraînement concerné dans « Feedback entraînement ». Un tap ouvre son
/// retour en lecture seule.
class TrainingColleagueFeedbackListTile extends StatelessWidget {
  const TrainingColleagueFeedbackListTile({
    super.key,
    required this.coachName,
    this.onTap,
  });

  /// Nom du collègue (vide si inconnu).
  final String coachName;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Raccord en « L » vers la séance juste au-dessus.
            SizedBox(
              width: ViroSpacing.lg,
              child: Align(
                alignment: Alignment.topRight,
                child: Container(
                  width: ViroSpacing.sm + 2,
                  height: ViroSpacing.lg,
                  margin: const EdgeInsets.only(right: ViroSpacing.xs),
                  decoration: BoxDecoration(
                    border: Border(
                      left: BorderSide(color: palette.borderStrong, width: 2),
                      bottom:
                          BorderSide(color: palette.borderStrong, width: 2),
                    ),
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(ViroSpacing.sm),
                    ),
                  ),
                ),
              ),
            ),
            Expanded(child: _card(context)),
          ],
        ),
      ),
    );
  }

  /// Carte du retour du collègue.
  Widget _card(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    return ViroCard(
        onTap: onTap,
        elevated: false,
        semanticLabel:
            AppCopy.training.colleagueFeedbackSemantics(coachName),
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm,
        ),
        child: Row(
          children: [
            ViroIcon(ViroIcons.roleCoach, size: 16, color: palette.textSecondary),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppCopy.training.colleagueFeedbackTitle(coachName),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.bodyMedium?.copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    AppCopy.training.colleagueFeedbackSubtitle,
                    style: theme.bodySmall?.copyWith(
                      color: palette.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            ViroIcon(ViroIcons.eye, size: 16, color: palette.textMuted),
          ],
        ),
    );
  }
}
