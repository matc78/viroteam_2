import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';
import 'package:viro_team_v2/widgets/common/whiteboard/whiteboard_painter.dart';

/// Outil actif du tableau blanc.
enum WhiteboardTool { pen, arrow, move }

/// Tableau blanc sur terrain de volley : trace au crayon ou en flèche, ou
/// déplace les jetons ([WhiteboardTool.move]). Les données restent
/// vectorielles (coordonnées 0–1) : [onChanged] reçoit chaque nouvel état.
class ViroWhiteboard extends StatefulWidget {
  const ViroWhiteboard({
    super.key,
    required this.data,
    required this.onChanged,
    this.tool = WhiteboardTool.pen,
    this.ink = WhiteboardInk.accent,
    this.onLimitReached,
  });

  final WhiteboardData data;
  final ValueChanged<WhiteboardData> onChanged;
  final WhiteboardTool tool;
  final WhiteboardInk ink;

  /// Appelé quand un trait est refusé (tableau plein).
  final VoidCallback? onLimitReached;

  @override
  State<ViroWhiteboard> createState() => _ViroWhiteboardState();
}

class _ViroWhiteboardState extends State<ViroWhiteboard> {
  List<WhiteboardPoint> _points = const [];
  int? _draggedToken;

  /// Aperçu pendant le déplacement d'un jeton (émis en fin de geste).
  WhiteboardData? _moving;

  WhiteboardPoint _normalized(Offset local, Size size) =>
      WhiteboardPoint(local.dx / size.width, local.dy / size.height).clamped();

  void _onPanStart(DragStartDetails details, Size size) {
    final point = _normalized(details.localPosition, size);
    if (widget.tool == WhiteboardTool.move) {
      _draggedToken = _tokenAt(point, size);
      if (_draggedToken != null) _moving = widget.data;
      return;
    }
    setState(() => _points = [point]);
  }

  void _onPanUpdate(DragUpdateDetails details, Size size) {
    final point = _normalized(details.localPosition, size);
    if (widget.tool == WhiteboardTool.move) {
      final index = _draggedToken;
      final moving = _moving;
      if (index == null || moving == null) return;
      final tokens = [...moving.tokens];
      tokens[index] = tokens[index].movedTo(point);
      setState(() => _moving = moving.copyWith(tokens: tokens));
      return;
    }
    setState(() {
      _points = widget.tool == WhiteboardTool.arrow
          ? [_points.first, point]
          : [..._points, point];
    });
  }

  void _onPanEnd() {
    if (widget.tool == WhiteboardTool.move) {
      final moved = _moving;
      setState(() {
        _draggedToken = null;
        _moving = null;
      });
      if (moved != null) widget.onChanged(moved);
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

    return AspectRatio(
      aspectRatio: whiteboardAspectRatio(widget.data.court),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final size = constraints.biggest;
            return Semantics(
              label: AppCopy.training.boardSemantics,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onPanStart: (d) => _onPanStart(d, size),
                onPanUpdate: (d) => _onPanUpdate(d, size),
                onPanEnd: (_) => _onPanEnd(),
                onPanCancel: _onPanEnd,
                child: CustomPaint(
                  size: size,
                  painter: WhiteboardPainter(
                    data: _moving ?? widget.data,
                    colors: colors,
                    pending: pending,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Miniature non interactive d'un schéma (liste d'exercices, fiche exercice).
class WhiteboardThumbnail extends StatelessWidget {
  const WhiteboardThumbnail({
    super.key,
    required this.data,
    this.width,
  });

  final WhiteboardData data;

  /// Largeur imposée ; sinon celle du parent.
  final double? width;

  @override
  Widget build(BuildContext context) {
    final board = AspectRatio(
      aspectRatio: whiteboardAspectRatio(data.court),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ViroSpacing.sm),
        child: ExcludeSemantics(
          child: CustomPaint(
            painter: WhiteboardPainter(
              data: data,
              colors: WhiteboardColors.of(context.viroPalette),
              textScale: 0.9,
            ),
          ),
        ),
      ),
    );
    return width == null ? board : SizedBox(width: width, child: board);
  }
}
