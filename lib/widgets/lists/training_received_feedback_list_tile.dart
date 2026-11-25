import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/club_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Retour de coach reçu (page Feedback, « Pour moi ») : bloc date, séance,
/// coachs, enfant concerné et pastille « Nouveau » tant qu'il n'est pas lu.
class TrainingReceivedFeedbackListTile extends StatelessWidget {
  const TrainingReceivedFeedbackListTile({
    super.key,
    required this.weekdayLabel,
    required this.dayLabel,
    required this.monthLabel,
    required this.title,
    required this.subtitle,
    required this.isNew,
    this.dateSemantics,
    this.childFirstName,
    this.clubName,
    this.clubColor,
    this.onTap,
  });

  /// Jour abrégé (« sam. »).
  final String weekdayLabel;

  /// Numéro du jour (« 21 »).
  final String dayLabel;

  /// Mois abrégé (« nov. »).
  final String monthLabel;

  /// Titre de l'entraînement.
  final String title;

  /// Équipe et coachs (« senior A · Coach Alexandre Petit »).
  final String subtitle;

  /// Au moins un retour pas encore lu.
  final bool isNew;

  /// Date lue par le lecteur d'écran (sinon jour + mois).
  final String? dateSemantics;

  /// Prénom de l'enfant quand un parent lit.
  final String? childFirstName;

  /// Club, affiché quand le compte en a plusieurs.
  final String? clubName;
  final Color? clubColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final child = childFirstName?.trim();
    final hasChips =
        (child != null && child.isNotEmpty) || (clubName != null && clubColor != null);

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        onTap: onTap,
        borderColor: isNew ? palette.accent : null,
        semanticLabel: AppCopy.training.receivedTileSemantics(
          title: title,
          date: dateSemantics ?? '$dayLabel $monthLabel',
          isNew: isNew,
        ),
        padding: const EdgeInsets.all(ViroSpacing.sm + 2),
        child: Row(
          children: [
            _DateBlock(
              weekday: weekdayLabel,
              day: dayLabel,
              month: monthLabel,
              highlighted: isNew,
            ),
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
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                  if (hasChips) ...[
                    const SizedBox(height: ViroSpacing.xs),
                    Wrap(
                      spacing: ViroSpacing.xs,
                      runSpacing: ViroSpacing.xs,
                      children: [
                        if (child != null && child.isNotEmpty)
                          _ChildChip(label: AppCopy.training.receivedForChild(child)),
                        if (clubName != null && clubColor != null)
                          ClubChip(label: clubName!, color: clubColor!),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            if (isNew)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.sm,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: palette.accentFill,
                  borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
                ),
                child: Text(
                  AppCopy.training.receivedNew,
                  style: theme.labelSmall?.copyWith(
                    color: palette.onAccent,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              )
            else
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

/// Bloc date vertical (jour, numéro, mois), teinté quand le retour est neuf.
class _DateBlock extends StatelessWidget {
  const _DateBlock({
    required this.weekday,
    required this.day,
    required this.month,
    required this.highlighted,
  });

  final String weekday;
  final String day;
  final String month;
  final bool highlighted;

  static const double _width = 52;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final ink = highlighted ? palette.accent : palette.textSecondary;

    return ExcludeSemantics(
      child: Container(
        width: _width,
        padding: const EdgeInsets.symmetric(vertical: ViroSpacing.xs + 2),
        decoration: BoxDecoration(
          color: highlighted ? palette.accentSofter : palette.surfaceSubtle,
          borderRadius: BorderRadius.circular(ViroSpacing.sm + 2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              weekday.toUpperCase(),
              style: theme.labelSmall?.copyWith(
                color: ink,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
            Text(
              day,
              style: theme.titleLarge?.copyWith(
                color: highlighted ? palette.brandText : palette.textPrimary,
                fontWeight: FontWeight.w800,
                height: 1.1,
              ),
            ),
            Text(
              month,
              style: theme.labelSmall?.copyWith(color: ink),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pastille « Pour Inès » (retour adressé à un enfant).
class _ChildChip extends StatelessWidget {
  const _ChildChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}
