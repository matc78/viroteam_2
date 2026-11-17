import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/utils/club_color.dart';

/// Dimensions et durées de la sélection (coche ronde, lignes et cartes
/// sélectionnables). Remplace les cases à cocher Material dans l'app.
abstract final class ViroSelection {
  /// Diamètre de la coche ronde.
  static const double markSize = 24;

  /// Épaisseur de l'anneau de la coche au repos.
  static const double markRingWidth = 2;

  /// Hauteur minimale d'une ligne sélectionnable (identique sélectionnée ou
  /// non : la sélection ne prend jamais de hauteur en plus).
  static const double rowMinHeight = 52;

  /// Rayon du fond teinté d'une ligne sélectionnée.
  static const double rowRadius = 12;

  /// Côté de la pastille d'icône d'une carte de droit.
  static const double glyphTileSize = 40;

  /// Rayon de la pastille d'icône.
  static const double glyphTileRadius = 12;

  /// Taille de l'icône dans sa pastille.
  static const double glyphSize = 22;

  /// Marge intérieure d'une carte sélectionnable.
  static const double cardPadding = 12;

  /// Épaisseur de la bordure d'une carte sélectionnable.
  static const double cardBorderWidth = 1.5;

  /// Opacité d'un contrôle verrouillé (droit déjà donné, enregistrement).
  static const double lockedOpacity = 0.5;

  /// Opacité de l'avatar d'une ligne non sélectionnée (joueur retiré).
  static const double unselectedAvatarOpacity = 0.5;

  /// Grossissement maximal du « pop » de la coche à la sélection.
  static const double markPopScale = 1.14;

  /// Durée du remplissage et du tracé de la coche.
  static const Duration markDuration = ViroMotion.drillIn;

  /// Durée de la teinte de fond et de la bordure.
  static const Duration fillDuration = ViroMotion.standard;

  /// Courbe de la teinte de fond.
  static const Curve fillCurve = ViroMotion.enter;

  /// Accent de sélection : [accentColor] si fourni, sinon l'accent du thème
  /// (couleur club sous `ClubAccentTheme`).
  static Color accentOf(BuildContext context, Color? accentColor) =>
      accentColor ?? Theme.of(context).colorScheme.primary;

  /// Fond teinté d'un élément sélectionné, pour [accent].
  static Color tintOf(Color accent) => ClubAccentStyle(accent).chipFill;

  /// Couleur d'accent lisible en texte / icône sur le fond courant.
  static Color readableAccentOf(BuildContext context, Color accent) =>
      context.viroPalette.readableAccent(accent);
}
