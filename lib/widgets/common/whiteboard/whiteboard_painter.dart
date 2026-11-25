import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';

/// Proportions du tableau (largeur / hauteur) selon le fond : terrain de
/// volley 9 × 18 m (entier, filet au milieu) ou 9 × 9 m (demi, filet en haut),
/// zone libre comprise.
double whiteboardAspectRatio(WhiteboardCourt court) => switch (court) {
      WhiteboardCourt.full => 0.62,
      WhiteboardCourt.half => 1.0,
    };

/// Couleurs du tableau résolues depuis la palette (clair / sombre).
class WhiteboardColors {
  const WhiteboardColors({
    required this.floor,
    required this.court,
    required this.lines,
    required this.net,
    required this.accentInk,
    required this.darkInk,
    required this.playerFill,
    required this.onPlayer,
  });

  /// Couleurs du tableau pour [palette].
  factory WhiteboardColors.of(ViroPalette palette) => WhiteboardColors(
        floor: palette.surfaceSubtle,
        court: ViroColors.sportOrange.withValues(alpha: 0.16),
        lines: palette.textSecondary,
        net: palette.textPrimary,
        accentInk: palette.accent,
        darkInk: palette.textPrimary,
        playerFill: palette.accentFill,
        onPlayer: palette.onAccent,
      );

  final Color floor;
  final Color court;
  final Color lines;
  final Color net;
  final Color accentInk;
  final Color darkInk;
  final Color playerFill;
  final Color onPlayer;

  /// Couleur d'un trait.
  Color ink(WhiteboardInk ink) => switch (ink) {
        WhiteboardInk.accent => accentInk,
        WhiteboardInk.red => ViroColors.error,
        WhiteboardInk.dark => darkInk,
      };
}

/// Dessine le terrain de volley, les traits et les jetons d'un
/// [WhiteboardData] (édition et miniature partagent ce painter).
class WhiteboardPainter extends CustomPainter {
  WhiteboardPainter({
    required this.data,
    required this.colors,
    this.pending,
    this.textScale = 1,
  });

  final WhiteboardData data;
  final WhiteboardColors colors;

  /// Trait en cours de tracé (pas encore dans [data]).
  final WhiteboardStroke? pending;

  /// Échelle des numéros de jetons (miniature plus petite).
  final double textScale;

  /// Rayon d'un jeton, relatif à la largeur du tableau.
  static const double tokenRadiusRatio = 0.045;

  @override
  void paint(Canvas canvas, Size size) {
    _paintCourt(canvas, size);
    for (final stroke in data.strokes) {
      _paintStroke(canvas, size, stroke);
    }
    if (pending != null) _paintStroke(canvas, size, pending!);
    for (final token in data.tokens) {
      _paintToken(canvas, size, token);
    }
  }

  void _paintCourt(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = colors.floor);
    final marginX = size.width * 0.1;
    final marginY = size.height * 0.06;
    final court = Rect.fromLTRB(
      marginX,
      data.court == WhiteboardCourt.half ? size.height * 0.08 : marginY,
      size.width - marginX,
      size.height - marginY,
    );
    canvas.drawRect(court, Paint()..color = colors.court);

    final line = Paint()
      ..color = colors.lines
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(1, size.width * 0.006);
    canvas.drawRect(court, line);

    final net = Paint()
      ..color = colors.net
      ..strokeWidth = math.max(2, size.width * 0.012)
      ..strokeCap = StrokeCap.round;

    if (data.court == WhiteboardCourt.full) {
      // 18 m de long : filet au milieu, lignes des 3 m de part et d'autre.
      final netY = court.center.dy;
      final attack = court.height * 3 / 18;
      for (final y in [netY - attack, netY + attack]) {
        canvas.drawLine(Offset(court.left, y), Offset(court.right, y), line);
      }
      canvas.drawLine(
        Offset(court.left - marginX * 0.4, netY),
        Offset(court.right + marginX * 0.4, netY),
        net,
      );
    } else {
      // 9 m : filet en haut, ligne des 3 m.
      final attackY = court.top + court.height * 3 / 9;
      canvas.drawLine(
        Offset(court.left, attackY),
        Offset(court.right, attackY),
        line,
      );
      canvas.drawLine(
        Offset(court.left - marginX * 0.4, court.top),
        Offset(court.right + marginX * 0.4, court.top),
        net,
      );
    }
  }

  void _paintStroke(Canvas canvas, Size size, WhiteboardStroke stroke) {
    if (stroke.points.length < 2) return;
    final paint = Paint()
      ..color = colors.ink(stroke.ink)
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(2, size.width * 0.01)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final points = [
      for (final p in stroke.points) Offset(p.x * size.width, p.y * size.height),
    ];

    if (stroke.kind == WhiteboardStrokeKind.arrow) {
      final start = points.first;
      final end = points.last;
      canvas.drawLine(start, end, paint);
      _paintArrowHead(canvas, start, end, paint, size.width * 0.045);
      return;
    }
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(path, paint);
  }

  void _paintArrowHead(
    Canvas canvas,
    Offset start,
    Offset end,
    Paint paint,
    double length,
  ) {
    final angle = math.atan2(end.dy - start.dy, end.dx - start.dx);
    const spread = math.pi / 7;
    for (final side in [-spread, spread]) {
      final tip = Offset(
        end.dx - length * math.cos(angle + side),
        end.dy - length * math.sin(angle + side),
      );
      canvas.drawLine(end, tip, paint);
    }
  }

  void _paintToken(Canvas canvas, Size size, WhiteboardToken token) {
    final center = Offset(
      token.position.x * size.width,
      token.position.y * size.height,
    );
    final radius = size.width * tokenRadiusRatio;
    final (fill, onFill) = switch (token.kind) {
      WhiteboardTokenKind.player => (colors.playerFill, colors.onPlayer),
      WhiteboardTokenKind.opponent => (ViroColors.error, ViroColors.white),
      WhiteboardTokenKind.ball => (ViroColors.sportYellow, colors.darkInk),
    };
    canvas.drawCircle(center, radius, Paint()..color = fill);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = colors.net.withValues(alpha: 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = math.max(1, radius * 0.12),
    );
    if (token.kind == WhiteboardTokenKind.ball) {
      // Coutures stylisées du ballon.
      final seam = Paint()
        ..color = onFill.withValues(alpha: 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = math.max(1, radius * 0.12);
      canvas.drawLine(
        center.translate(-radius * 0.7, 0),
        center.translate(radius * 0.7, 0),
        seam,
      );
      return;
    }
    if (token.label.isEmpty) return;
    final text = TextPainter(
      text: TextSpan(
        text: token.label,
        style: TextStyle(
          color: onFill,
          fontSize: radius * 1.05 * textScale,
          fontWeight: FontWeight.w800,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    text.paint(
      canvas,
      center - Offset(text.width / 2, text.height / 2),
    );
  }

  @override
  bool shouldRepaint(covariant WhiteboardPainter oldDelegate) =>
      oldDelegate.data != data ||
      oldDelegate.pending != pending ||
      oldDelegate.colors.floor != colors.floor ||
      oldDelegate.colors.accentInk != colors.accentInk;
}
