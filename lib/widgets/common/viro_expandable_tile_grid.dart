import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Construit la tuile [index] ; [expanded] vaut `true` pour la tuile dépliée.
typedef ViroExpandableTileBuilder =
    Widget Function(BuildContext context, int index, bool expanded);

/// Grille de petites tuiles dont une seule peut se déplier sur toute la
/// largeur : elle prend sa ligne et les tuiles voisines glissent en dessous
/// (positions et hauteur animées).
///
/// Le nombre de colonnes dépend de la largeur disponible ([minTileWidth]).
/// Les hauteurs sont fixes ([tileHeight], [expandedHeight]) pour pouvoir
/// animer chaque tuile vers sa nouvelle place.
class ViroExpandableTileGrid extends StatelessWidget {
  const ViroExpandableTileGrid({
    super.key,
    required this.itemCount,
    required this.itemKey,
    required this.itemBuilder,
    required this.tileHeight,
    required this.expandedHeight,
    this.expandedIndex,
    this.minTileWidth = 96,
    this.maxColumns = 6,
    this.spacing = ViroSpacing.sm,
  });

  final int itemCount;

  /// Clé stable d'une tuile (conserve son état quand elle se déplace).
  final Key Function(int index) itemKey;
  final ViroExpandableTileBuilder itemBuilder;
  final double tileHeight;
  final double expandedHeight;

  /// Tuile dépliée, `null` si aucune.
  final int? expandedIndex;
  final double minTileWidth;
  final int maxColumns;
  final double spacing;

  /// Positions de chaque tuile pour une largeur [width] et [columns]
  /// colonnes ; renvoie aussi la hauteur totale.
  ({List<Rect> rects, double height}) _layout(double width, int columns) {
    final tileWidth = (width - spacing * (columns - 1)) / columns;
    final rects = List<Rect>.filled(itemCount, Rect.zero);
    final expanded =
        expandedIndex != null &&
            expandedIndex! >= 0 &&
            expandedIndex! < itemCount
        ? expandedIndex
        : null;
    // La tuile dépliée prend la ligne où elle se trouvait.
    final insertAt = expanded == null ? -1 : (expanded ~/ columns) * columns;
    var top = 0.0;
    var column = 0;
    var expandedPlaced = false;

    void placeExpanded() {
      if (column > 0) {
        top += tileHeight + spacing;
        column = 0;
      }
      rects[expanded!] = Rect.fromLTWH(0, top, width, expandedHeight);
      top += expandedHeight + spacing;
      expandedPlaced = true;
    }

    var placed = 0;
    for (var index = 0; index < itemCount; index++) {
      if (index == expanded) continue;
      if (expanded != null && !expandedPlaced && placed == insertAt) {
        placeExpanded();
      }
      if (column == columns) {
        top += tileHeight + spacing;
        column = 0;
      }
      rects[index] = Rect.fromLTWH(
        column * (tileWidth + spacing),
        top,
        tileWidth,
        tileHeight,
      );
      column++;
      placed++;
    }
    if (expanded != null && !expandedPlaced) placeExpanded();

    final height = itemCount == 0
        ? 0.0
        : column > 0
        ? top + tileHeight
        : top - spacing;
    return (rects: rects, height: height);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = math.max(
          1,
          math.min(
            maxColumns,
            ((width + spacing) / (minTileWidth + spacing)).floor(),
          ),
        );
        final layout = _layout(width, columns);
        return AnimatedContainer(
          duration: ViroMotion.drillIn,
          curve: ViroMotion.enter,
          width: width,
          height: layout.height,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              for (var index = 0; index < itemCount; index++)
                AnimatedPositioned(
                  key: itemKey(index),
                  duration: ViroMotion.drillIn,
                  curve: ViroMotion.enter,
                  left: layout.rects[index].left,
                  top: layout.rects[index].top,
                  width: layout.rects[index].width,
                  height: layout.rects[index].height,
                  child: itemBuilder(context, index, index == expandedIndex),
                ),
            ],
          ),
        );
      },
    );
  }
}
