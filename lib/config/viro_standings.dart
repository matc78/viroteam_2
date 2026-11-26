import 'package:viro_team_v2/config/viro_spacing.dart';

/// Dimensions des écrans de classement FFVB (classement de poule, saison
/// d'une équipe, sélecteur club / équipe).
abstract final class ViroStandings {
  /// Écart entre la barre des clubs et les segments d'équipe.
  static const double switcherGap = ViroSpacing.md - ViroSpacing.xs;

  /// Trait d'accent devant un titre de section.
  static const double sectionBarWidth = 4;
  static const double sectionBarHeight = 16;
  static const double sectionBarRadius = 2;

  /// Médaille de rang de la carte héro de la saison.
  static const double heroBadge = 52;

  /// Pastille V / D de la forme récente (et son ombre).
  static const double formChip = 24;
  static const double formChipShadowBlur = 6;
  static const double formChipShadowOffsetY = 2;

  /// Marge intérieure des tuiles de stats (bilan, sets, points, dom./ext.).
  static const double statTilePadding = ViroSpacing.sm + 2;

  /// Écart entre le libellé d'une stat et sa valeur.
  static const double statLabelGap = 2;

  /// Jauge pour / contre : hauteur et écart entre les deux parts.
  static const double ratioBarHeight = 5;
  static const double ratioBarGap = 2;

  /// Pastilles de répartition des scores (« 3-0 ×1 ») : écart et marge
  /// verticale.
  static const double breakdownSpacing = ViroSpacing.xs + 2;
  static const double breakdownChipVerticalPadding = 3;

  /// Pastille d'icône domicile / extérieur.
  static const double sideIconBox = 32;
  static const double sideIcon = 16;

  /// Icône de salle.
  static const double venueIcon = 18;
}
