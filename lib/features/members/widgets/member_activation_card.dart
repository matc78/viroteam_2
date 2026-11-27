import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/member/member_activation.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Libellé d’une étape d’activation.
String memberActivationLabel(MemberActivationBucket bucket) => switch (bucket) {
  MemberActivationBucket.toInvite => AppCopy.members.activationToInvite,
  MemberActivationBucket.pendingInvite => AppCopy.members.activationPending,
  MemberActivationBucket.noEmail => AppCopy.members.activationNoEmail,
  MemberActivationBucket.linked => AppCopy.members.activationLinked,
};

String _bucketHint(MemberActivationBucket bucket) => switch (bucket) {
  MemberActivationBucket.toInvite => AppCopy.members.activationToInviteHint,
  MemberActivationBucket.pendingInvite => AppCopy.members.activationPendingHint,
  MemberActivationBucket.noEmail => AppCopy.members.activationNoEmailHint,
  MemberActivationBucket.linked => AppCopy.members.activationLinkedHint,
};

/// Ordre d’affichage : ce qui demande une action d’abord.
const _bucketOrder = [
  MemberActivationBucket.toInvite,
  MemberActivationBucket.pendingInvite,
  MemberActivationBucket.noEmail,
  MemberActivationBucket.linked,
];

/// Carte de suivi d’activation des comptes (gestion des membres) : part des
/// comptes liés, barre de progression et quatre étapes qui filtrent la liste
/// (re-tap sur l’étape active = retour à toute la liste).
class MemberActivationCard extends StatelessWidget {
  const MemberActivationCard({
    super.key,
    required this.stats,
    required this.selected,
    required this.onSelected,
    this.accentColor,
  });

  final MemberActivationStats stats;

  /// Étape filtrée, `null` = toute la liste.
  final MemberActivationBucket? selected;

  /// Nouvelle étape filtrée (`null` pour retirer le filtre).
  final ValueChanged<MemberActivationBucket?> onSelected;

  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final accent = accentColor ?? palette.accentFill;
    final current = selected;

    return ViroCard(
      margin: EdgeInsets.zero,
      elevated: false,
      padding: const EdgeInsets.all(ViroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            stats.allLinked
                ? AppCopy.members.activationAllLinked
                : AppCopy.members.activationSummary(
                    stats.linked,
                    stats.total,
                    stats.linkedPercent,
                  ),
            style: theme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: palette.brandText,
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(ViroSpacing.xs),
            child: LinearProgressIndicator(
              value: stats.total == 0 ? 0 : stats.linked / stats.total,
              minHeight: ViroSpacing.xs,
              backgroundColor: palette.surfaceSubtle,
              color: accent,
            ),
          ),
          if (!stats.allLinked) ...[
            const SizedBox(height: ViroSpacing.md),
            Row(
              children: [
                for (var i = 0; i < _bucketOrder.length; i++) ...[
                  if (i > 0) const SizedBox(width: ViroSpacing.xs),
                  Expanded(
                    child: _ActivationStep(
                      label: memberActivationLabel(_bucketOrder[i]),
                      count: stats.count(_bucketOrder[i]),
                      selected: current == _bucketOrder[i],
                      accent: accent,
                      onTap: () {
                        ViroHaptics.selection();
                        onSelected(
                          current == _bucketOrder[i] ? null : _bucketOrder[i],
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              current == null
                  ? AppCopy.members.activationHint
                  : _bucketHint(current),
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActivationStep extends StatelessWidget {
  const _ActivationStep({
    required this.label,
    required this.count,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final foreground = selected
        ? ViroColors.white
        : palette.readableAccent(accent);

    return ViroPressable(
      label: AppCopy.members.activationFilterSemantics(label, count, selected),
      onTap: onTap,
      borderRadius: BorderRadius.circular(ViroSpacing.sm),
      child: AnimatedContainer(
        duration: ViroMotion.fast,
        constraints: const BoxConstraints(
          minHeight: ViroSpacing.minTouchTarget,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.xs,
          vertical: ViroSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: selected ? accent : palette.surfaceSubtle,
          borderRadius: BorderRadius.circular(ViroSpacing.sm),
          border: Border.all(color: selected ? accent : palette.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$count',
              style: theme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: foreground,
              ),
            ),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: theme.labelSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: selected ? ViroColors.white : palette.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
