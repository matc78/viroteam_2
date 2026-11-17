import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Loader animé : les trois morceaux du logo s'assemblent avec un petit
/// rebond, puis repartent. Aucune dépendance.
///
/// Usage :
///   const ViroLogoLoader()
///   const ViroLogoLoader(size: 96)
///   ViroLogoLoader(color: palette.accent)
class ViroLogoLoader extends StatefulWidget {
  const ViroLogoLoader({
    super.key,
    this.size = 48,
    this.color,
    this.duration = const Duration(milliseconds: 1400),
  });

  /// Taille totale du loader (carré).
  final double size;

  /// Couleur des pièces ; défaut [ViroPalette.brandStrong].
  final Color? color;

  /// Durée d'un cycle assemblage / désassemblage.
  final Duration duration;

  @override
  State<ViroLogoLoader> createState() => _ViroLogoLoaderState();
}

class _ViroLogoLoaderState extends State<ViroLogoLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Respecte le réglage « réduire les animations » du système.
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.stop();
      _controller.value = 0.5; // logo assemblé, fixe
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant ViroLogoLoader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.duration != widget.duration) {
      _controller.duration = widget.duration;
      if (!MediaQuery.disableAnimationsOf(context) &&
          !_controller.isAnimating) {
        _controller.repeat();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? context.viroPalette.brandStrong;
    return Semantics(
      label: AppCopy.common.loading,
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size.square(widget.size),
          painter: _LogoPainter(_controller, color),
        ),
      ),
    );
  }
}

class _Piece {
  _Piece({
    required List<Offset> points,
    required this.delay,
    required this.from,
    this.rotation = 0,
    this.startScaleX = 1,
    this.startScaleY = 1,
  })  : path = Path()..addPolygon(points, true),
        center = (Path()..addPolygon(points, true)).getBounds().center;

  final Path path;
  final Offset center;
  final double delay; // décalage dans le cycle (0..1)
  final Offset from; // position de départ (en unités du logo, base 151)
  final double rotation; // radians
  final double startScaleX;
  final double startScaleY;
}

class _LogoPainter extends CustomPainter {
  _LogoPainter(this.animation, this.color) : super(repaint: animation);

  final Animation<double> animation;
  final Color color;

  // Le logo vectorisé est dessiné dans un carré de 151 x 151.
  static const double _base = 151;

  static final List<_Piece> _pieces = [
    // Barre du haut
    _Piece(
      points: const [
        Offset(13, 11),
        Offset(138, 11),
        Offset(131, 28),
        Offset(20, 28),
      ],
      delay: 0,
      from: const Offset(0, -48),
      startScaleX: 0.7,
    ),
    // « V » + pied du T
    _Piece(
      points: const [
        Offset(67, 27),
        Offset(83, 27),
        Offset(83, 138),
        Offset(68, 138),
        Offset(25, 41),
        Offset(44, 41),
        Offset(66, 91),
      ],
      delay: 0.05,
      from: const Offset(0, 54),
    ),
    // Éclat de droite
    _Piece(
      points: const [
        Offset(125, 40),
        Offset(108, 40),
        Offset(95, 67),
        Offset(95, 110),
      ],
      delay: 0.10,
      from: const Offset(46, -30),
      rotation: 24 * math.pi / 180,
      startScaleX: 0.6,
      startScaleY: 0.6,
    ),
  ];

  static const Cubic _bounce = Cubic(0.2, 0.9, 0.25, 1.15);

  // Sur un cycle de 1,4 s : assemblage 0,63 s, pause 0,18 s, désassemblage 0,38 s.
  static const double _assembleEnd = 0.63 / 1.4; // ≈ 0.45
  static const double _holdEnd = (0.63 + 0.18) / 1.4; // ≈ 0.579
  static const double _disassembleEnd = (0.63 + 0.18 + 0.38) / 1.4; // 0.85

  /// 1 = assemblé, 0 = éloigné. Peut dépasser 1 (rebond à l'arrivée).
  static double _assembly(double t, double delay) {
    final p = (t - delay) % 1.0;
    if (p < _assembleEnd) {
      return _bounce.transform(p / _assembleEnd);
    }
    if (p < _holdEnd) return 1;
    if (p < _disassembleEnd) {
      final q = (p - _holdEnd) / (_disassembleEnd - _holdEnd);
      return 1 - Curves.easeIn.transform(q);
    }
    return 0;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final t = animation.value;
    canvas.save();
    canvas.scale(size.width / _base);

    for (final piece in _pieces) {
      final amount = _assembly(t, piece.delay);
      final away = 1 - amount;
      final opacity = amount.clamp(0.0, 1.0);
      if (opacity <= 0) continue;

      canvas.save();
      canvas.translate(
        piece.center.dx + piece.from.dx * away,
        piece.center.dy + piece.from.dy * away,
      );
      canvas.rotate(piece.rotation * away);
      canvas.scale(
        1 - (1 - piece.startScaleX) * away,
        1 - (1 - piece.startScaleY) * away,
      );
      canvas.translate(-piece.center.dx, -piece.center.dy);
      canvas.drawPath(
        piece.path,
        Paint()
          ..style = PaintingStyle.fill
          ..isAntiAlias = true
          ..color = color.withAlpha((color.a * 255 * opacity).round()),
      );
      canvas.restore();
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LogoPainter old) => old.color != color;
}
