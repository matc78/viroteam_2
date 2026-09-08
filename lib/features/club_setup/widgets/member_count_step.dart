import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Étape effectif — sélecteur numérique compact (flèches + valeur).
class MemberCountStep extends StatelessWidget {
  const MemberCountStep({
    super.key,
    required this.memberCountRange,
    required this.onChanged,
  });

  final String? memberCountRange;
  final void Function(String? range) onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final values = ClubMemberCountRanges.all;
    final selected = memberCountRange;
    final selectedIndex =
        selected == null ? -1 : values.indexOf(selected);
    // Valeur hors catalogue (brouillon legacy) → affichage neutre, pas de faux « sélectionné ».
    final effectiveSelected = selectedIndex >= 0 ? selected : null;
    final displayIndex = selectedIndex >= 0 ? selectedIndex : 0;
    final displayValue = values[displayIndex];
    final canGoPrev = displayIndex > 0;
    final canGoNext = displayIndex < values.length - 1;

    return SetupStepShell(
      centerBody: true,
      subtitle: 'Combien de membres gérez-vous environ ? (optionnel)',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _ArrowButton(
                icon: ViroIcons.chevronLeft,
                enabled: canGoPrev || effectiveSelected == null,
                onTap: () {
                  if (effectiveSelected == null) {
                    onChanged(displayValue);
                    return;
                  }
                  if (!canGoPrev) return;
                  onChanged(values[displayIndex - 1]);
                },
              ),
              const SizedBox(width: ViroSpacing.md),
              ViroPressable(
                onTap: () {
                  if (effectiveSelected == null) {
                    onChanged(displayValue);
                  } else {
                    onChanged(null);
                  }
                },
                borderRadius: BorderRadius.circular(20),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 132,
                  padding: const EdgeInsets.symmetric(
                    vertical: ViroSpacing.md,
                    horizontal: ViroSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: effectiveSelected != null
                        ? ViroColors.sportCyan.withValues(alpha: 0.14)
                        : ViroColors.surfaceCard,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: effectiveSelected != null
                          ? ViroColors.sportCyan
                          : ViroColors.primary100,
                      width: effectiveSelected != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(
                        ClubMemberCountRanges.label(displayValue),
                        textAlign: TextAlign.center,
                        style: theme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: effectiveSelected != null
                              ? ViroColors.sportCyan
                              : ViroColors.primary800,
                        ),
                      ),
                      Text(
                        'membres',
                        style: theme.labelSmall?.copyWith(
                          color: ViroColors.gray600,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: ViroSpacing.md),
              _ArrowButton(
                icon: ViroIcons.chevronRight,
                enabled: canGoNext || effectiveSelected == null,
                onTap: () {
                  if (effectiveSelected == null) {
                    onChanged(displayValue);
                    return;
                  }
                  if (!canGoNext) return;
                  onChanged(values[displayIndex + 1]);
                },
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          Text(
            effectiveSelected == null
                ? 'Touchez pour sélectionner, ou passez.'
                : 'Touchez la valeur pour désélectionner.',
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
          ),
        ],
      ),
    );
  }
}

class _ArrowButton extends StatelessWidget {
  const _ArrowButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ViroPressable(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: enabled
              ? ViroColors.primary50
              : ViroColors.gray100.withValues(alpha: 0.5),
        ),
        alignment: Alignment.center,
        child: ViroIcon(
          icon,
          size: 22,
          color: enabled ? ViroColors.primary800 : ViroColors.gray400,
        ),
      ),
    );
  }
}
