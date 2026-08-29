import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Grille de couleurs prédéfinies : unie obligatoire + bicolore optionnelle.
class ClubBrandColorPicker extends StatelessWidget {
  const ClubBrandColorPicker({
    super.key,
    required this.selectedPrimaryHex,
    this.selectedSecondaryHex,
    required this.onPrimarySelected,
    required this.onSecondaryToggled,
  });

  final String selectedPrimaryHex;
  final String? selectedSecondaryHex;
  final ValueChanged<String> onPrimarySelected;
  final ValueChanged<String?> onSecondaryToggled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          'Couleurs unies',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: ViroSpacing.sm),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: ViroSpacing.sm,
          runSpacing: ViroSpacing.sm,
          children: [
            for (final color in clubBrandColorPresets)
              _SingleColorSwatch(
                color: color,
                selected: clubBrandColorsMatch(
                  selectedPrimaryHex,
                  colorToHex(color),
                ),
                onTap: () => onPrimarySelected(colorToHex(color)),
              ),
          ],
        ),
        const SizedBox(height: ViroSpacing.lg),
        Text(
          'Bicolores',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          'Choisissez une 2e couleur en plus de la couleur unie. '
          'Re-cliquez pour la retirer. '
          'Gauche : accès membre. Droite : gestion du club.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: ViroSpacing.sm),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: ViroSpacing.sm,
          runSpacing: ViroSpacing.sm,
          children: [
            for (final color in clubBrandColorPresets)
              _SingleColorSwatch(
                color: color,
                selected: selectedSecondaryHex != null &&
                    clubBrandColorsMatch(
                      selectedSecondaryHex,
                      colorToHex(color),
                    ),
                disabled: clubBrandColorsMatch(
                  selectedPrimaryHex,
                  colorToHex(color),
                ),
                onTap: () {
                  final hex = colorToHex(color);
                  if (clubBrandColorsMatch(selectedSecondaryHex, hex)) {
                    onSecondaryToggled(null);
                  } else {
                    onSecondaryToggled(hex);
                  }
                },
              ),
          ],
        ),
      ],
    );
  }
}

class _SingleColorSwatch extends StatelessWidget {
  const _SingleColorSwatch({
    required this.color,
    required this.selected,
    required this.onTap,
    this.disabled = false,
  });

  final Color color;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  static const double _swatchSize = 40;

  @override
  Widget build(BuildContext context) {
    final isLight = color.computeLuminance() > 0.55;
    final checkColor = isLight ? ViroColors.gray900 : Colors.white;

    return Opacity(
      opacity: disabled ? 0.35 : 1,
      child: ViroPressable(
        onTap: disabled ? null : onTap,
        enabled: !disabled,
        floating: false,
        minSize: _swatchSize,
        borderRadius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: _swatchSize,
          height: _swatchSize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            border: Border.all(
              color: selected
                  ? ViroColors.gray900
                  : Colors.black.withValues(alpha: 0.1),
              width: selected ? 2.5 : 1,
            ),
          ),
          alignment: Alignment.center,
          child: selected
              ? ViroIcon(
                  ViroIcons.check,
                  color: checkColor,
                  size: 18,
                )
              : null,
        ),
      ),
    );
  }
}
