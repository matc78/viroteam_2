import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Bouton icône flottant (menus, actions header, FAB secondaires).
///
/// [tooltip] est obligatoire : affiché au long-press et annoncé au lecteur
/// d’écran via [ViroPressable.label].
class ViroFloatingIconButton extends StatelessWidget {
  const ViroFloatingIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.circular = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;

  /// Libellé accessible (tooltip + Semantics).
  final String tooltip;
  final Color? backgroundColor;
  final Color? foregroundColor;

  /// Pastille ronde (ex. action `+` style inbox) au lieu du carré arrondi.
  final bool circular;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final bg = backgroundColor ?? palette.surfaceCard;
    final fg = foregroundColor ?? palette.brandText;
    final radius = BorderRadius.circular(circular ? 999 : 14);

    return Tooltip(
      message: tooltip,
      child: ViroPressable(
        onTap: onPressed,
        enabled: onPressed != null,
        borderRadius: radius,
        label: tooltip,
        child: Container(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: radius,
            boxShadow: ViroMotion.floatingShadow(palette, opacity: 0.16, blur: 18, y: 5),
          ),
          child: Padding(
            padding: EdgeInsets.all(circular ? 10 : 11),
            child: ViroIcon(icon, size: circular ? 20 : 22, color: fg),
          ),
        ),
      ),
    );
  }
}

/// FAB principal — ombre prononcée, animation au appui via [ViroPressable].
class ViroFloatingActionButton extends StatelessWidget {
  const ViroFloatingActionButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.label,
    this.semanticLabel,
    this.accentColor,
  });

  final IconData icon;
  final VoidCallback onPressed;

  /// Texte visible à côté de l’icône (optionnel).
  final String? label;

  /// Libellé lecteur d’écran (défaut : [label]).
  final String? semanticLabel;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final accent =
        accentColor ?? Theme.of(context).colorScheme.primary;
    final accentDark = Color.lerp(accent, Colors.black, 0.18)!;

    return ViroPressable(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(16),
      label: semanticLabel ?? label,
      child: Material(
        color: accent,
        elevation: 0,
        shadowColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: label != null ? ViroSpacing.md : 14,
            vertical: 14,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [accent, accentDark],
            ),
            boxShadow: ViroMotion.floatingShadow(context.viroPalette, opacity: 0.22, blur: 20, y: 8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ViroIcon(icon, color: ViroColors.white, size: 24),
              if (label != null) ...[
                const SizedBox(width: ViroSpacing.sm),
                Text(
                  label!,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: ViroColors.white,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
