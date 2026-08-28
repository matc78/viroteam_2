import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Étape 0 — ce qu'il faut savoir avant de créer un club.
class PrerequisitesStep extends StatelessWidget {
  const PrerequisitesStep({super.key, this.showResumeBanner = false});

  final bool showResumeBanner;

  static final _items = [
    (ViroIcons.groups, 'Nom et sport du club', 'Comme vos membres vous connaissent'),
    (ViroIcons.place, 'Ville et lieu de pratique', 'Stade, salle, gymnase…'),
    (ViroIcons.image, 'Logo et description', 'Ajoutables ou modifiables plus tard'),
    (ViroIcons.calendar, 'Vos priorités', 'Planning, cotisations, annonces…'),
    (ViroIcons.roleAdmin, 'Rôle administrateur', 'Invitez vos membres par code'),
  ];

  static const _cardWidthFactor = 0.86;

  @override
  Widget build(BuildContext context) {
    return SetupStepShell(
      title: 'Avant de commencer',
      subtitle: 'Quelques infos et c\'est lancé — on sauvegarde au fur et à mesure.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showResumeBanner) ...[
            _ResumeBanner(),
            const SizedBox(height: ViroSpacing.sm),
          ],
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final slotHeight = constraints.maxHeight / _items.length;
                return Column(
                  children: [
                    for (var index = 0; index < _items.length; index++)
                      SizedBox(
                        height: slotHeight,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Align(
                            alignment: index.isEven
                                ? Alignment.centerLeft
                                : Alignment.centerRight,
                            child: FractionallySizedBox(
                              widthFactor: _cardWidthFactor,
                              child: _PrerequisiteItem(
                                icon: _items[index].$1,
                                title: _items[index].$2,
                                subtitle: _items[index].$3,
                                accent: ClubSetupUi.prerequisiteAccents[index],
                                mirrored: index.isOdd,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ResumeBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: ViroColors.sportGreen.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        border: Border.all(color: ViroColors.sportGreen.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          ViroIcon(ViroIcons.check, color: ViroColors.sportGreen, size: 18),
          const SizedBox(width: ViroSpacing.sm),
          Expanded(
            child: Text(
              'Reprise de votre création en cours',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ViroColors.primary800,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PrerequisiteItem extends StatelessWidget {
  const _PrerequisiteItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.mirrored,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final bool mirrored;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    final iconWidget = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      ),
      alignment: Alignment.center,
      child: ViroIcon(icon, color: accent, size: 20),
    );

    final textWidget = Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment:
            mirrored ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: mirrored ? TextAlign.right : TextAlign.left,
            style: theme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: ViroColors.primary800,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: mirrored ? TextAlign.right : TextAlign.left,
            style: theme.bodySmall?.copyWith(
              color: ViroColors.gray600,
              height: 1.3,
            ),
          ),
        ],
      ),
    );

    return ViroCard(
      elevated: true,
      margin: EdgeInsets.zero,
      accentColor: accent,
      padding: EdgeInsets.fromLTRB(
        mirrored ? ViroSpacing.sm : ViroSpacing.md,
        ViroSpacing.md,
        mirrored ? ViroSpacing.md : ViroSpacing.sm,
        ViroSpacing.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: mirrored
            ? [textWidget, const SizedBox(width: ViroSpacing.md), iconWidget]
            : [iconWidget, const SizedBox(width: ViroSpacing.md), textWidget],
      ),
    );
  }
}
