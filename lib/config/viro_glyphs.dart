import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Icônes dessinées pour ViroTeam (SVG deux tons : trait + aplat à 20 %),
/// dans `assets/icons/glyphs/`. Pour tout le reste : [ViroIcons] (Phosphor).
enum ViroGlyph {
  admin('admin'),
  licence('licence'),
  maillot('maillot'),
  calendrier('calendrier'),
  megaphone('megaphone'),
  piece('piece'),
  oeil('oeil'),
  clubHouse('club_house'),
  plot('plot'),
  bulles('bulles'),
  journal('journal'),
  sifflet('sifflet');

  const ViroGlyph(this.fileName);

  final String fileName;

  /// Chemin de l'asset SVG.
  String get assetPath => 'assets/icons/glyphs/$fileName.svg';
}

/// Rendu d'un [ViroGlyph], recoloré en [color] (aplat compris).
///
/// Mêmes règles d'accessibilité que `ViroIcon` : décorative sans
/// [semanticLabel], informative seule avec.
class ViroGlyphIcon extends StatelessWidget {
  const ViroGlyphIcon(
    this.glyph, {
    super.key,
    this.size = 22,
    this.color,
    this.semanticLabel,
  });

  final ViroGlyph glyph;
  final double size;
  final Color? color;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final resolvedColor = color ??
        IconTheme.of(context).color ??
        Theme.of(context).colorScheme.onSurface;
    final picture = SvgPicture.asset(
      glyph.assetPath,
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(resolvedColor, BlendMode.srcIn),
    );
    if (semanticLabel == null) return ExcludeSemantics(child: picture);
    return Semantics(label: semanticLabel, image: true, child: picture);
  }
}
