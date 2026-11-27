import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Seuil sous lequel un taux de présence passe en ton d'alerte (%), comme
/// sur le portail.
const int viroRateWarningThreshold = 50;

/// Barre fine d'un taux 0–100 (vide si [rate] est `null`) : accent, ou ton
/// d'alerte sous [viroRateWarningThreshold]. Décorative : le taux est
/// toujours écrit à côté.
class ViroRateBar extends StatelessWidget {
  const ViroRateBar({super.key, required this.rate});

  final int? rate;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final value = rate;
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ViroSpacing.xs),
        child: LinearProgressIndicator(
          value: value == null ? 0 : value.clamp(0, 100) / 100,
          minHeight: ViroSpacing.xs + 2,
          backgroundColor: palette.surfaceSubtle,
          color: value != null && value < viroRateWarningThreshold
              ? ViroColors.warning
              : palette.accentFill,
        ),
      ),
    );
  }
}
