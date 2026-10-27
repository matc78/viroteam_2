import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';

/// Durées, courbes et élévations — interactions fluides et surfaces flottantes.
abstract final class ViroMotion {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration standard = Duration(milliseconds: 220);
  /// Drill-in messagerie (inbox → fil), ~feeling WhatsApp.
  static const Duration drillIn = Duration(milliseconds: 280);
  static const Duration modal = Duration(milliseconds: 320);
  /// Mise en avant d’un élément ouvert par une notif : affichage puis fondu.
  static const Duration focusHighlightHold = Duration(milliseconds: 2400);
  static const Duration focusHighlightFade = Duration(milliseconds: 600);
  /// Ouverture de l'œil « vu » (`SeenEye`), attente avant la première
  /// ouverture (sheet posé) et décalage entre deux lignes.
  static const Duration seenEyeOpen = Duration(milliseconds: 1400);
  static const Duration seenEyeStartDelay = Duration(milliseconds: 700);
  static const Duration seenEyeStagger = Duration(milliseconds: 180);

  static const Curve enter = Curves.easeOutCubic;
  static const Curve exit = Curves.easeInCubic;
  static const Curve emphasis = Curves.easeOutBack;

  static const double pressScale = 0.97;
  static const double hoverScale = 1.015;

  static const double elevationRest = 5;
  static const double elevationHover = 10;
  static const double elevationPressed = 2;
  static const double elevationCard = 8;
  static const double elevationMenu = 12;
  static const double elevationFab = 10;

  /// Ombre générique (boutons, icônes), teintée selon [palette] : bleutée en
  /// clair, plus dense et neutre en sombre.
  static List<BoxShadow> floatingShadow(
    ViroPalette palette, {
    double opacity = 0.14,
    double blur = 16,
    double y = 6,
  }) {
    final strength = palette.shadowStrength;
    final tint = palette.isDark ? palette.shadowTint : ViroColors.primary900;
    return [
      BoxShadow(
        color: tint.withValues(alpha: (opacity * strength).clamp(0, 1)),
        blurRadius: blur,
        offset: Offset(0, y),
      ),
      BoxShadow(
        color: Colors.black
            .withValues(alpha: (opacity * 0.35 * strength).clamp(0, 1)),
        blurRadius: blur * 0.35,
        offset: const Offset(0, 2),
      ),
    ];
  }

  /// Ombre des cartes — douce, teintée selon [palette].
  static List<BoxShadow> cardShadow(
    ViroPalette palette, {
    bool elevated = true,
  }) {
    final strength = palette.shadowStrength;
    return [
      BoxShadow(
        color: palette.shadowTint
            .withValues(alpha: (elevated ? 0.08 : 0.04) * strength),
        blurRadius: elevated ? 20 : 12,
        spreadRadius: -4,
        offset: Offset(0, elevated ? 8 : 4),
      ),
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.03 * strength),
        blurRadius: 4,
        offset: const Offset(0, 1),
      ),
    ];
  }

  /// Ombre de tuile à bordure accentuée (fiche club) : [cardShadow] + halo
  /// léger de [borderColor] en sombre pour détacher la tuile du fond bleu nuit.
  static List<BoxShadow> accentBorderTileShadow(
    ViroPalette palette,
    Color borderColor, {
    bool elevated = true,
  }) {
    if (!palette.isDark) {
      return cardShadow(palette, elevated: elevated);
    }
    return [
      ...cardShadow(palette, elevated: elevated),
      BoxShadow(
        color: borderColor.withValues(alpha: 0.32),
        blurRadius: 16,
      ),
    ];
  }
}
