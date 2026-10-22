import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Pastille nom de club (couleur de marque).
///
/// [filled] : fond plein marque + texte contrasté (inbox chat, style portail).
class ClubChip extends StatelessWidget {
  const ClubChip({
    super.key,
    required this.label,
    required this.color,
    this.filled = false,
  });

  final String label;
  final Color color;

  /// Fond opaque couleur club (sinon teinte légère + bordure).
  final bool filled;

  @override
  Widget build(BuildContext context) {
    if (filled) {
      final onBrand =
          color.computeLuminance() > 0.45 ? ViroColors.brandInkOnVivid : ViroColors.white;
      return Container(
        constraints: const BoxConstraints(maxWidth: 160),
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: onBrand,
                fontWeight: FontWeight.w700,
                fontSize: 10,
              ),
        ),
      );
    }

    final palette = context.viroPalette;
    // En sombre : couleur ravivée + bordure plus franche, sinon une marque
    // foncée se fond dans la carte.
    final readable = palette.readableAccent(color);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: ViroSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: readable.withValues(alpha: palette.isDark ? 0.12 : 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: readable.withValues(alpha: palette.isDark ? 0.7 : 0.4),
        ),
        boxShadow: palette.neonBoxGlow(readable, blur: 8),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: readable,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}
