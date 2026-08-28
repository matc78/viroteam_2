import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Bouton CTA avec cadre portail (triple bordure), calqué sur [FinalCta] web.
///
/// Couches : dégradé cyan→vert→orange · blanc + [primary200] · [sportOrange].
class ViroPortalButton extends StatelessWidget {
  const ViroPortalButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  /// Valeurs alignées sur `FinalCta.module.css` (.frame / .frameInner / .panel).
  static const _gradientPadding = 4.0;
  static const _frameBorderWidth = 2.0;
  static const _frameInnerPadding = 4.0;
  static const _panelBorderWidth = 2.0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final isDisabled = onPressed == null || isLoading;
    final buttonHeight = ViroSpacing.buttonHeightLarge;

    final panelRadius = BorderRadius.circular(
      buttonHeight / 2 + _panelBorderWidth,
    );
    final middleHeight =
        buttonHeight + _panelBorderWidth * 2 + _frameInnerPadding * 2;
    final middleRadius = BorderRadius.circular(
      middleHeight / 2 + _frameBorderWidth,
    );
    final outerHeight =
        middleHeight + _frameBorderWidth * 2 + _gradientPadding * 2;
    final outerRadius = BorderRadius.circular(outerHeight / 2);

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: outerRadius,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ViroColors.sportCyan,
            ViroColors.sportGreen,
            ViroColors.sportOrange,
          ],
          stops: [0.0, 0.45, 1.0],
        ),
        boxShadow: _portalButtonShadow,
      ),
      child: Padding(
        padding: const EdgeInsets.all(_gradientPadding),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: ViroColors.white,
            borderRadius: middleRadius,
            border: Border.all(
              color: ViroColors.primary200,
              width: _frameBorderWidth,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(_frameInnerPadding),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: isDisabled ? ViroColors.gray100 : ViroColors.white,
                borderRadius: panelRadius,
                border: Border.all(
                  color: isDisabled ? ViroColors.gray300 : ViroColors.sportOrange,
                  width: _panelBorderWidth,
                ),
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: isDisabled ? null : onPressed,
                  borderRadius: panelRadius,
                  splashColor: ViroColors.primary100.withValues(alpha: 0.45),
                  highlightColor: ViroColors.primary50.withValues(alpha: 0.35),
                  child: SizedBox(
                    width: double.infinity,
                    height: buttonHeight,
                    child: Center(
                      child: isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: ViroColors.primary600,
                              ),
                            )
                          : Text(
                              label,
                              style: theme.titleSmall?.copyWith(
                                color: isDisabled
                                    ? ViroColors.gray400
                                    : ViroColors.primary800,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Halo doux uniforme autour du cadre portail.
  static final _portalButtonShadow = [
    BoxShadow(
      color: ViroColors.primary900.withValues(alpha: 0.14),
      blurRadius: 22,
      spreadRadius: 1,
    ),
    BoxShadow(
      color: ViroColors.primary600.withValues(alpha: 0.1),
      blurRadius: 14,
      spreadRadius: 0,
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 8,
      spreadRadius: -1,
    ),
  ];
}
