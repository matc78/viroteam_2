import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';

/// Échelle typo Inter — docs/specs/viroteam_v2_design_system_final.md
///
/// Police bundlée dans `assets/fonts/` (pas de fetch réseau google_fonts).
abstract final class ViroTypography {
  static const String _fontFamily = 'Inter';

  /// Thème texte Inter appliqué sur le [TextTheme] de base Material.
  static TextTheme textTheme(TextTheme base) {
    TextStyle withInter(TextStyle? style) =>
        (style ?? const TextStyle()).copyWith(fontFamily: _fontFamily);

    return base.copyWith(
      headlineLarge: withInter(base.headlineLarge).copyWith(
        fontSize: 32,
        fontWeight: FontWeight.w600,
        height: 1.2,
        color: ViroColors.gray900,
      ),
      headlineMedium: withInter(base.headlineMedium).copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        height: 1.2,
        color: ViroColors.gray900,
      ),
      titleMedium: withInter(base.titleMedium).copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        height: 1.3,
        color: ViroColors.gray900,
      ),
      bodyLarge: withInter(base.bodyLarge).copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 1.5,
        color: ViroColors.gray900,
      ),
      bodyMedium: withInter(base.bodyMedium).copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.5,
        color: ViroColors.gray600,
      ),
      bodySmall: withInter(base.bodySmall).copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 1.4,
        color: ViroColors.gray400,
      ),
      labelLarge: withInter(base.labelLarge).copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        height: 1.5,
        color: ViroColors.gray600,
      ),
      labelSmall: withInter(base.labelSmall).copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.6,
        color: ViroColors.gray600,
      ),
    );
  }

  /// Style des en-têtes de section (labels uppercase discrets).
  static TextStyle get sectionHeader => const TextStyle(
        fontFamily: _fontFamily,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.6,
        color: ViroColors.gray600,
      );
}
