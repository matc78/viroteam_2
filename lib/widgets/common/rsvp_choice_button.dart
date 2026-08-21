import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Bouton d'action RSVP (Présent / Absent).
///
/// Mode rempli : fond [color], texte blanc.
/// Mode [outlined] : fond grisé, bordure colorée, texte atténué.
class RsvpChoiceButton extends StatelessWidget {
  const RsvpChoiceButton({
    super.key,
    required this.label,
    required this.color,
    required this.onTap,
    this.height = ViroSpacing.buttonHeightMedium,
    this.outlined = false,
    this.borderColor,
    this.foregroundColor,
  });

  final String label;
  final Color color;
  final VoidCallback onTap;
  final double height;
  final bool outlined;
  final Color? borderColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(ViroSpacing.buttonRadius);
    final textColor =
        foregroundColor ?? (outlined ? ViroColors.gray600 : ViroColors.white);
    final background = outlined ? ViroColors.gray100 : color;
    final outline = borderColor ?? (outlined ? color : null);

    return Material(
      color: background,
      elevation: outlined ? 0 : 4,
      shadowColor: outlined ? Colors.transparent : color.withValues(alpha: 0.5),
      shape: RoundedRectangleBorder(
        borderRadius: radius,
        side: outline != null
            ? BorderSide(color: outline, width: 1.5)
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: Center(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: textColor,
                    fontWeight: outlined ? FontWeight.w600 : FontWeight.w700,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}
