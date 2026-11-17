import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_selection.dart';

/// Coche ronde de sélection : anneau au repos, disque plein et coche tracée
/// quand [value] vaut `true`, tiret quand [value] vaut `null` (état partiel).
///
/// Purement visuelle : la ligne ou la carte qui la porte gère le tap et la
/// sémantique (`checked`). [enabled] `false` = coche verrouillée, atténuée.
class ViroSelectionMark extends StatefulWidget {
  const ViroSelectionMark({
    super.key,
    required this.value,
    this.color,
    this.enabled = true,
    this.size = ViroSelection.markSize,
  });

  /// `true` sélectionné, `false` vide, `null` partiel.
  final bool? value;

  /// Couleur de remplissage ; accent du thème par défaut.
  final Color? color;
  final bool enabled;
  final double size;

  @override
  State<ViroSelectionMark> createState() => _ViroSelectionMarkState();
}

class _ViroSelectionMarkState extends State<ViroSelectionMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: ViroSelection.markDuration,
    value: widget.value == false ? 0 : 1,
  );

  @override
  void didUpdateWidget(ViroSelectionMark oldWidget) {
    super.didUpdateWidget(oldWidget);
    final wasOn = oldWidget.value != false;
    final isOn = widget.value != false;
    if (wasOn == isOn) return;
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _controller.value = isOn ? 1 : 0;
    } else if (isOn) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final fill = ViroSelection.accentOf(context, widget.color);
    return ExcludeSemantics(
      child: Opacity(
        opacity: widget.enabled ? 1 : ViroSelection.lockedOpacity,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final progress = _controller.value;
            // « Pop » à la sélection seulement, pas au retour à vide.
            final pop = _controller.status == AnimationStatus.forward
                ? 1 + (ViroSelection.markPopScale - 1) * math.sin(math.pi * progress)
                : 1.0;
            return Transform.scale(
              scale: pop,
              child: CustomPaint(
                size: Size.square(widget.size),
                painter: _SelectionMarkPainter(
                  progress: progress,
                  partial: widget.value == null,
                  ringColor: palette.borderStrong,
                  fillColor: fill,
                  glyphColor: palette.onAccent,
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _SelectionMarkPainter extends CustomPainter {
  const _SelectionMarkPainter({
    required this.progress,
    required this.partial,
    required this.ringColor,
    required this.fillColor,
    required this.glyphColor,
  });

  final double progress;
  final bool partial;
  final Color ringColor;
  final Color fillColor;
  final Color glyphColor;

  /// Repère du tracé (coche et tiret), en unités d'une grille de 16.
  static const double _glyphGrid = 16;

  /// Part du diamètre occupée par la coche.
  static const double _glyphRatio = 14 / 24;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide / 2;
    final t = progress.clamp(0.0, 1.0);

    canvas.drawCircle(
      center,
      radius - ViroSelection.markRingWidth / 2,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = ViroSelection.markRingWidth
        ..color = Color.lerp(ringColor, fillColor, t)!,
    );
    if (t == 0) return;
    canvas.drawCircle(
      center,
      radius,
      Paint()..color = fillColor.withValues(alpha: fillColor.a * t),
    );

    final glyphBox = size.shortestSide * _glyphRatio;
    final scale = glyphBox / _glyphGrid;
    final origin = center - Offset(glyphBox / 2, glyphBox / 2);
    Offset point(double x, double y) => origin + Offset(x * scale, y * scale);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = glyphColor;

    if (partial) {
      canvas.drawLine(
        point(4, 8),
        point(12, 8),
        stroke..color = glyphColor.withValues(alpha: glyphColor.a * t),
      );
      return;
    }

    // La coche se trace une fois le disque à moitié rempli.
    final drawn = ((t - 0.3) / 0.7).clamp(0.0, 1.0);
    if (drawn == 0) return;
    final check = Path()
      ..moveTo(point(3.5, 8.5).dx, point(3.5, 8.5).dy)
      ..lineTo(point(6.5, 11.5).dx, point(6.5, 11.5).dy)
      ..lineTo(point(12.5, 4.5).dx, point(12.5, 4.5).dy);
    final metric = check.computeMetrics().first;
    canvas.drawPath(metric.extractPath(0, metric.length * drawn), stroke);
  }

  @override
  bool shouldRepaint(_SelectionMarkPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.partial != partial ||
      oldDelegate.ringColor != ringColor ||
      oldDelegate.fillColor != fillColor ||
      oldDelegate.glyphColor != glyphColor;
}
