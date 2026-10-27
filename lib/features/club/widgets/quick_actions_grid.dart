import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

class QuickAction {
  const QuickAction({
    required this.label,
    required this.icon,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
}

class _QuickActionsGridBase extends StatelessWidget {
  const _QuickActionsGridBase({
    required this.actions,
    this.accentColor,
  });

  final List<QuickAction> actions;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.screenHorizontal,
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: ViroSpacing.sm,
          crossAxisSpacing: ViroSpacing.sm,
          childAspectRatio: 1.75,
        ),
        itemCount: actions.length,
        itemBuilder: (context, index) {
          return _QuickActionCell(
            action: actions[index],
            accentColor: accentColor,
          );
        },
      ),
    );
  }
}

/// Cellule grille — remplit la hauteur de la cellule et centre le contenu.
class _QuickActionCell extends StatelessWidget {
  const _QuickActionCell({
    required this.action,
    this.accentColor,
  });

  final QuickAction action;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final radius = BorderRadius.circular(ViroSpacing.cardRadius);
    final labelStyle = Theme.of(context).textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
        );
    final accentStyle = accentColor != null
        ? ClubAccentStyle(accentColor!)
        : null;
    final iconColor = accentColor != null
        ? palette.readableAccent(accentColor!)
        : palette.accent;
    final borderColor = accentStyle?.border ??
        palette.accentSoft.withValues(alpha: 0.45);
    final labelColor = iconColor;

    return ViroPressable(
      onTap: action.onTap,
      borderRadius: radius,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: palette.surfaceCard,
          borderRadius: radius,
          border: Border.all(color: borderColor),
          boxShadow:
              ViroMotion.accentBorderTileShadow(palette, borderColor),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.sm,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ViroIcon(
                action.icon,
                size: 24,
                color: iconColor,
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                action.label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: labelStyle?.copyWith(color: labelColor),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Accueil famille : Planning, Cotisation, Infos (pas de gestion club).
class FamilyQuickActionsGrid extends StatelessWidget {
  const FamilyQuickActionsGrid({
    super.key,
    this.accentColor,
    required this.onPlanning,
    required this.onFee,
    required this.onInfos,
  });

  final Color? accentColor;
  final VoidCallback onPlanning;
  final VoidCallback onFee;
  final VoidCallback onInfos;

  @override
  Widget build(BuildContext context) {
    return _QuickActionsGridBase(
      accentColor: accentColor,
      actions: [
        QuickAction(
          label: AppCopy.club.actionPlanning,
          icon: ViroIcons.calendar,
          onTap: onPlanning,
        ),
        QuickAction(
          label: AppCopy.club.actionFee,
          icon: ViroIcons.payments,
          onTap: onFee,
        ),
        QuickAction(
          label: AppCopy.club.actionInfos,
          icon: ViroIcons.bell,
          onTap: onInfos,
        ),
      ],
    );
  }
}

