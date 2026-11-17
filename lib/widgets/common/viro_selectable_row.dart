import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_selection.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';

/// Ligne de liste sélectionnable : coche ronde + fond teinté quand
/// [selected], sans changer de hauteur. Un nouveau tap rend la forme
/// d'origine.
///
/// [onChanged] reçoit le nouvel état ; `null` = ligne verrouillée.
/// [markLeading] place la coche en tête (à la place d'un avatar).
class ViroSelectableRow extends StatelessWidget {
  const ViroSelectableRow({
    super.key,
    required this.selected,
    required this.onChanged,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.markLeading = false,
    this.accentColor,
    this.semanticLabel,
    this.padding = const EdgeInsets.symmetric(horizontal: ViroSpacing.sm),
    this.borderRadius,
    this.minHeight = ViroSelection.rowMinHeight,
  });

  final bool selected;
  final ValueChanged<bool>? onChanged;
  final String title;
  final Widget? subtitle;
  final Widget? leading;

  /// Info complémentaire avant la coche (ex. « Pas convoqué »).
  final Widget? trailing;
  final bool markLeading;
  final Color? accentColor;

  /// Libellé lecteur d'écran ; [title] par défaut.
  final String? semanticLabel;
  final EdgeInsetsGeometry padding;

  /// Rayon du fond teinté ; [ViroSelection.rowRadius] par défaut.
  final BorderRadius? borderRadius;
  final double minHeight;

  void _toggle() {
    ViroHaptics.selection();
    onChanged?.call(!selected);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final textTheme = Theme.of(context).textTheme;
    final accent = ViroSelection.accentOf(context, accentColor);
    final tint = ViroSelection.tintOf(accent);
    final radius =
        borderRadius ?? BorderRadius.circular(ViroSelection.rowRadius);
    final enabled = onChanged != null;
    final mark = ViroSelectionMark(
      value: selected,
      color: accent,
      enabled: enabled,
    );

    return MergeSemantics(
      child: Semantics(
        checked: selected,
        enabled: enabled,
        label: semanticLabel,
        excludeSemantics: semanticLabel != null,
        child: ViroPressable(
          onTap: enabled ? _toggle : null,
          enabled: enabled,
          floating: false,
          borderRadius: radius,
          child: AnimatedContainer(
            duration: ViroSelection.fillDuration,
            curve: ViroSelection.fillCurve,
            constraints: BoxConstraints(minHeight: minHeight),
            padding: padding,
            decoration: BoxDecoration(
              color: selected ? tint : tint.withValues(alpha: 0),
              borderRadius: radius,
            ),
            child: Row(
              children: [
                if (markLeading) ...[
                  mark,
                  const SizedBox(width: ViroSpacing.md),
                ],
                if (leading != null) ...[
                  leading!,
                  const SizedBox(width: ViroSpacing.md),
                ],
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AnimatedDefaultTextStyle(
                        duration: ViroSelection.fillDuration,
                        style: (textTheme.bodyMedium ?? const TextStyle())
                            .copyWith(
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.w500,
                          color: selected
                              ? palette.textPrimary
                              : palette.textSecondary,
                        ),
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      ?subtitle,
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: ViroSpacing.sm),
                  trailing!,
                ],
                if (!markLeading) ...[
                  const SizedBox(width: ViroSpacing.md),
                  mark,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
