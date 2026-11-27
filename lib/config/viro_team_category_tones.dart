import 'package:flutter/material.dart';

/// Teintes des catégories d’équipe : mêmes valeurs que les tokens `--tone-*`
/// du portail (`globals.css`, `teamCategoryTone.ts`), pour qu’une catégorie
/// ait la même couleur dans l’app et sur le portail.
enum TeamCategoryTone {
  blue(Color(0xFF1A5F9E)),
  orange(Color(0xFFEA580C)),
  green(Color(0xFF059669)),
  violet(Color(0xFF7C3AED)),
  amber(Color(0xFFF59E0B)),
  cyan(Color(0xFF0891B2)),
  pink(Color(0xFFDB2777)),
  lime(Color(0xFF65A30D)),
  indigo(Color(0xFF4F46E5)),
  red(Color(0xFFDC2626)),
  teal(Color(0xFF0D9488)),

  /// Réservé à « Sans catégorie ».
  slate(Color(0xFF475569));

  const TeamCategoryTone(this.color);

  /// Couleur vive de la catégorie (pastille, trait d’accent).
  final Color color;

  /// Ordre d’attribution (aligné portail `PALETTE_ORDER`) : deux catégories
  /// voisines (M11 / M13) reçoivent des teintes éloignées ; sans `slate`.
  static const List<TeamCategoryTone> paletteOrder = [
    blue,
    orange,
    green,
    violet,
    amber,
    cyan,
    pink,
    lime,
    indigo,
    red,
    teal,
  ];
}
