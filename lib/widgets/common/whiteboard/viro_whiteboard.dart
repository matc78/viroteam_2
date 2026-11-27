import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';
import 'package:viro_team_v2/widgets/common/whiteboard/whiteboard_painter.dart';

/// Outil actif du tableau blanc.
enum WhiteboardTool { pen, arrow, move }

/// Tableau blanc sur terrain de volley : trace au crayon ou en flèche.
/// Comme sur le portail, les jetons et les flèches (ou une extrémité de
/// flèche) se déplacent avec tous les outils ; [WhiteboardTool.move] ne fait
/// que ça. Un tap sur une flèche la sélectionne ([selectedArrow]), un double
/// tap sur un joueur ou un adversaire demande à changer son numéro
/// ([onEditTokenLabel]). Les données restent vectorielles (coordonnées
/// 0–1) : [onChanged] reçoit chaque nouvel état.
class ViroWhiteboard extends StatefulWidget {
  const ViroWhiteboard({
    super.key,
    required this.data,
    required this.onChanged,
    this.tool = WhiteboardTool.pen,
    this.ink = WhiteboardInk.accent,
    this.onLimitReached,
    this.selectedArrow,
    this.onSelectedArrowChanged,
    this.onEditTokenLabel,
  });

  final WhiteboardData data;
  final ValueChanged<WhiteboardData> onChanged;
  final WhiteboardTool tool;
  final WhiteboardInk ink;

  /// Appelé quand un trait est refusé (tableau plein).
  final VoidCallback? onLimitReached;

  /// Index (dans `data.strokes`) de la flèche sélectionnée, poignées sur ses
  /// extrémités.
  final int? selectedArrow;

  /// Sélection d'une flèche (tap ou saisie) ou désélection (`null`).
  final ValueChanged<int?>? onSelectedArrowChanged;

  /// Double tap sur un joueur ou un adversaire : index du jeton.
  final ValueChanged<int>? onEditTokenLabel;

  @override
  State<ViroWhiteboard> createState() => _ViroWhiteboardState();
}

/// Objet saisi pendant un geste : un jeton, ou une flèche (ou une extrémité).
sealed class _Drag {
  const _Drag();
}

class _TokenDrag extends _Drag {
  const _TokenDrag(this.index);

  final int index;
}

class _ArrowDrag extends _Drag {
  const _ArrowDrag({
    required this.index,
    required this.part,
    required this.origin,
    required this.original,
  });

  final int index;
  final WhiteboardArrowPart part;
  final WhiteboardPoint origin;
  final WhiteboardStroke original;
}

class _ViroWhiteboardState extends State<ViroWhiteboard> {
  /// Rayon de prise d'une extrémité de flèche (relatif à la largeur, comme
  /// le portail), jamais sous la moitié d'une cible tactile.
  static const double _arrowHandleRatio = 0.03;

  /// Distance de prise du trait d'une flèche (relative à la largeur).
  static const double _arrowBodyRatio = 0.018;

  List<WhiteboardPoint> _points = const [];
  _Drag? _drag;
  Offset? _doubleTapPosition;

  /// Aperçu pendant un déplacement (émis en fin de geste).
  WhiteboardData? _moving;

  WhiteboardPoint _normalized(Offset local, Size size) =>
      WhiteboardPoint(local.dx / size.width, local.dy / size.height).clamped();

  WhiteboardArrowHit? _arrowAt(WhiteboardPoint point, Size size) =>
      whiteboardArrowAt(
        widget.data,
        point,
        width: size.width,
        height: size.height,
        handleRadius: math.max(
          size.width * _arrowHandleRatio,
          ViroSpacing.minTouchTarget / 2,
        ),
        bodyTolerance: math.max(
          size.width * _arrowBodyRatio,
          ViroSpacing.minTouchTarget / 4,
        ),
      );

  void _select(int? index) {
    if (index != widget.selectedArrow) {
      widget.onSelectedArrowChanged?.call(index);
    }
  }

  void _onPanStart(DragStartDetails details, Size size) {
    final point = _normalized(details.localPosition, size);
    final token = _tokenAt(point, size);
    if (token != null) {
      _select(null);
      setState(() {
        _drag = _TokenDrag(token);
        _moving = widget.data;
      });
      return;
    }
    final arrow = _arrowAt(point, size);
    if (arrow != null) {
      _select(arrow.index);
      setState(() {
        _drag = _ArrowDrag(
          index: arrow.index,
          part: arrow.part,
          origin: point,
          original: widget.data.strokes[arrow.index],
        );
        _moving = widget.data;
      });
      return;
    }
    _select(null);
    if (widget.tool == WhiteboardTool.move) return;
    setState(() => _points = [point]);
  }

  void _onPanUpdate(DragUpdateDetails details, Size size) {
    final point = _normalized(details.localPosition, size);
    final drag = _drag;
    final moving = _moving;
    if (drag != null && moving != null) {
      setState(() {
        switch (drag) {
          case _TokenDrag(:final index):
            final tokens = [...moving.tokens];
            tokens[index] = tokens[index].movedTo(point);
            _moving = moving.copyWith(tokens: tokens);
          case _ArrowDrag():
            final strokes = [...moving.strokes];
            strokes[drag.index] = whiteboardDragArrow(
              drag.original,
              drag.part,
              drag.origin,
              point,
            );
            _moving = moving.copyWith(strokes: strokes);
        }
      });
      return;
    }
    if (_points.isEmpty) return;
    setState(() {
      _points = widget.tool == WhiteboardTool.arrow
          ? [_points.first, point]
          : [..._points, point];
    });
  }

  void _onPanEnd() {
    if (_drag != null) {
      final moved = _moving;
      setState(() {
        _drag = null;
        _moving = null;
      });
      // Une saisie sans déplacement ne crée pas d'étape d'annulation.
      if (moved != null && !identical(moved, widget.data)) {
        widget.onChanged(moved);
      }
      return;
    }
    final points = _points;
    setState(() => _points = const []);
    if (points.length < 2) return;
    if (widget.data.strokes.length >= WhiteboardData.maxStrokes) {
      widget.onLimitReached?.call();
      return;
    }
    final stroke = WhiteboardStroke(
      kind: widget.tool == WhiteboardTool.arrow
          ? WhiteboardStrokeKind.arrow
          : WhiteboardStrokeKind.pen,
      ink: widget.ink,
      points: WhiteboardData.simplify(points),
    );
    widget.onChanged(
      widget.data.copyWith(strokes: [...widget.data.strokes, stroke]),
    );
  }

  /// Jeton sous [point] (le plus récent d'abord), `null` sinon.
  int? _tokenAt(WhiteboardPoint point, Size size) {
    final hitRadius = size.width * WhiteboardPainter.tokenRadiusRatio * 1.6;
    for (var i = widget.data.tokens.length - 1; i >= 0; i--) {
      final token = widget.data.tokens[i].position;
      final dx = (token.x - point.x) * size.width;
      final dy = (token.y - point.y) * size.height;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) return i;
    }
    return null;
  }

  /// Tap simple : sélectionne la flèche touchée, sinon désélectionne.
  void _onTapUp(TapUpDetails details, Size size) {
    final point = _normalized(details.localPosition, size);
    if (_tokenAt(point, size) != null) {
      _select(null);
      return;
    }
    _select(_arrowAt(point, size)?.index);
  }

  /// Double tap sur un joueur ou un adversaire : édition de son numéro.
  void _onDoubleTap(Size size) {
    final position = _doubleTapPosition;
    _doubleTapPosition = null;
    if (position == null) return;
    final index = _tokenAt(_normalized(position, size), size);
    if (index == null || !widget.data.tokens[index].hasLabel) return;
    widget.onEditTokenLabel?.call(index);
  }

  @override
  Widget build(BuildContext context) {
    final colors = WhiteboardColors.of(context.viroPalette);
    final pending = _points.length < 2
        ? null
        : WhiteboardStroke(
            kind: widget.tool == WhiteboardTool.arrow
                ? WhiteboardStrokeKind.arrow
                : WhiteboardStrokeKind.pen,
            ink: widget.ink,
            points: _points,
          );

    // Flèche sélectionnée encore valide (une annulation a pu la retirer).
    final shown = _moving ?? widget.data;
    final selected = widget.selectedArrow;
    final activeArrow =
        selected != null &&
            selected >= 0 &&
            selected < shown.strokes.length &&
            shown.strokes[selected].kind == WhiteboardStrokeKind.arrow
        ? selected
        : null;

    final radius = BorderRadius.circular(ViroSpacing.cardRadius);
    final palette = context.viroPalette;
    return AspectRatio(
      aspectRatio: whiteboardAspectRatio(widget.data.court),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          border: Border.all(color: palette.borderStrong, width: 1.5),
        ),
        child: ClipRRect(
          borderRadius: radius,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final size = constraints.biggest;
              return Semantics(
                label: AppCopy.training.boardSemantics,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  // Saisie au point touché (pas après le seuil de glissé) :
                  // un jeton ou une flèche se prend là où le doigt s'est posé.
                  dragStartBehavior: DragStartBehavior.down,
                  onPanStart: (d) => _onPanStart(d, size),
                  onPanUpdate: (d) => _onPanUpdate(d, size),
                  onPanEnd: (_) => _onPanEnd(),
                  onPanCancel: _onPanEnd,
                  onTapUp: (d) => _onTapUp(d, size),
                  onDoubleTapDown: (d) => _doubleTapPosition = d.localPosition,
                  onDoubleTap: () => _onDoubleTap(size),
                  child: CustomPaint(
                    size: size,
                    painter: WhiteboardPainter(
                      data: _moving ?? widget.data,
                      colors: colors,
                      pending: pending,
                      selectedStroke: activeArrow,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Miniature non interactive d'un schéma (liste d'exercices, fiche exercice).
class WhiteboardThumbnail extends StatelessWidget {
  const WhiteboardThumbnail({super.key, required this.data, this.width});

  final WhiteboardData data;

  /// Largeur imposée ; sinon celle du parent.
  final double? width;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final radius = BorderRadius.circular(ViroSpacing.sm);
    final board = AspectRatio(
      aspectRatio: whiteboardAspectRatio(data.court),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          border: Border.all(color: palette.borderStrong),
        ),
        child: ClipRRect(
          borderRadius: radius,
          child: ExcludeSemantics(
            child: CustomPaint(
              painter: WhiteboardPainter(
                data: data,
                colors: WhiteboardColors.of(palette),
                textScale: 0.9,
              ),
            ),
          ),
        ),
      ),
    );
    return width == null ? board : SizedBox(width: width, child: board);
  }
}
