import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Indicateur « vu » : œil fermé (trait) si [seen] est faux, sinon œil qui
/// s'ouvre une seule fois (paupières, iris, halo, éclat) puis reste statique.
///
/// L'animation part au premier montage, après [delay] (cascade entre lignes) ;
/// elle ne se rejoue ni au rebuild ni au scroll. Avec
/// `MediaQuery.disableAnimations` ou [animate] à `false`, l'état final est
/// affiché directement.
class SeenEye extends StatefulWidget {
  const SeenEye({
    super.key,
    required this.seen,
    this.animate = true,
    this.delay = Duration.zero,
    this.size = 22,
    this.seenDetail,
  });

  final bool seen;

  /// `false` : œil ouvert d'emblée quand [seen].
  final bool animate;

  /// Attente avant l'ouverture (ex. rang de la ligne × `ViroMotion.seenEyeStagger`).
  final Duration delay;

  /// Côté du carré dessiné.
  final double size;

  /// Précision quand [seen] (ex. « Vu le 12/10 à 13h45… ») : remplace le
  /// libellé lecteur d'écran et complète le tooltip.
  final String? seenDetail;

  @override
  State<SeenEye> createState() => _SeenEyeState();
}

class _SeenEyeState extends State<SeenEye> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _progress;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    final total = widget.delay + ViroMotion.seenEyeOpen;
    _controller = AnimationController(vsync: this, duration: total);
    final delayFraction =
        widget.delay.inMicroseconds / total.inMicroseconds;
    _progress = CurvedAnimation(
      parent: _controller,
      curve: Interval(delayFraction, 1),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // MediaQuery n'est pas lisible dans initState : démarrage au premier
    // passage ici, une seule fois.
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (!_started) {
      _started = true;
      if (!widget.seen) return;
      if (reduceMotion || !widget.animate) {
        _controller.value = 1;
      } else {
        _controller.forward();
      }
    } else if (reduceMotion && _controller.isAnimating) {
      _controller.value = 1;
    }
  }

  @override
  void didUpdateWidget(SeenEye oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Changement live (ex. snapshot Firestore) : pas de rejeu, état final direct.
    if (oldWidget.seen != widget.seen) {
      _controller.value = widget.seen ? 1 : 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final detail = widget.seenDetail;
    final eye = Semantics(
      label: widget.seen
          ? detail ?? AppCopy.common.seen
          : AppCopy.common.notSeenYet,
      image: true,
      child: SizedBox.square(
        dimension: widget.size,
        child: CustomPaint(
          painter: SeenEyePainter(
            progress: _progress,
            colors: SeenEyeColors.of(context.viroPalette),
          ),
        ),
      ),
    );
    if (!widget.seen) return eye;
    return Tooltip(
      message: detail == null
          ? AppCopy.common.seenTooltip
          : '${AppCopy.common.seenTooltip}\n$detail',
      excludeFromSemantics: true,
      child: eye,
    );
  }
}

/// Couleurs de [SeenEye], dérivées de la palette du thème.
@immutable
class SeenEyeColors {
  const SeenEyeColors({
    required this.closed,
    required this.open,
    required this.outline,
    required this.center,
    required this.halo,
    required this.sparkles,
  });

  /// Fermé : gris atténué. Remplissages : ambre pâle. Contours (paupières /
  /// pupille) : ambre plein. Paillettes sport multicolores.
  factory SeenEyeColors.of(ViroPalette palette) {
    final soft = softWarningOf(palette);
    final outline = palette.warningText;
    if (palette.isDark) {
      return SeenEyeColors(
        closed: palette.textMuted,
        open: soft,
        outline: outline,
        center: palette.brandStrong,
        halo: soft.withValues(alpha: 0.28),
        sparkles: _sparklePalette,
      );
    }
    return SeenEyeColors(
      closed: palette.textMuted,
      open: soft,
      outline: outline,
      center: palette.surfaceCard,
      halo: soft.withValues(alpha: 0.16),
      sparkles: _sparklePalette,
    );
  }

  /// Ambre jaune-orangé clair : même famille que [ViroColors.warning],
  /// volontairement moins saturé pour ne pas concurrencer le badge RSVP.
  static Color softWarningOf(ViroPalette palette) {
    if (palette.isDark) {
      return Color.lerp(palette.warningText, palette.textMuted, 0.4)!;
    }
    return Color.lerp(palette.warningText, palette.surfaceCard, 0.42)!;
  }

  static const _sparklePalette = [
    ViroColors.sportYellow,
    ViroColors.sportOrange,
    ViroColors.sportCyan,
    ViroColors.sportGreen,
  ];

  final Color closed;
  final Color open;
  final Color outline;
  final Color center;
  final Color halo;
  final List<Color> sparkles;

  @override
  bool operator ==(Object other) =>
      other is SeenEyeColors &&
      other.closed == closed &&
      other.open == open &&
      other.outline == outline &&
      other.center == center &&
      other.halo == halo &&
      _sameSparkles(other.sparkles);

  bool _sameSparkles(List<Color> other) {
    if (identical(sparkles, other)) return true;
    if (sparkles.length != other.length) return false;
    for (var index = 0; index < sparkles.length; index++) {
      if (sparkles[index] != other[index]) return false;
    }
    return true;
  }

  @override
  int get hashCode => Object.hash(
        closed,
        open,
        outline,
        center,
        halo,
        Object.hashAll(sparkles),
      );
}

/// Dessine l'œil de [SeenEye] pour une [progress] d'ouverture 0 → 1.
///
/// Séquence : paupières (0 → 50 %), iris (30 → 80 %), halo (25 → 85 %),
/// éclat (72 → 100 %).
class SeenEyePainter extends CustomPainter {
  SeenEyePainter({required this.progress, required this.colors})
      : super(repaint: progress);

  final Animation<double> progress;
  final SeenEyeColors colors;

  static const _lidCurve = Interval(0, 0.5, curve: Curves.easeOutBack);
  static const _irisCurve = Interval(0.3, 0.8, curve: Curves.easeOutBack);
  static const _haloWindow = Interval(0.25, 0.85);
  static const _sparkleWindow = Interval(0.72, 1);
  static const _irisDots = 8;

  /// Écartement des paupières (0 fermé, 1 ouvert ; léger dépassement possible).
  @visibleForTesting
  double get lidOpenness => _lidCurve.transform(progress.value);

  /// Échelle de l'iris (0 caché, 1 plein).
  @visibleForTesting
  double get irisScale => _irisCurve.transform(progress.value);

  @override
  void paint(Canvas canvas, Size size) {
    final side = size.shortestSide;
    final center = size.center(Offset.zero);
    final halfWidth = side * 0.42;
    final maxLift = side * 0.26;
    final lid = lidOpenness;
    final openness = lid.clamp(0.0, 1.0);
    final upperLift = maxLift * lid;
    final lowerLift = upperLift * 0.8;

    _paintHalo(canvas, center, side);

    final left = center.translate(-halfWidth, 0);
    final right = center.translate(halfWidth, 0);
    // Contrôle quadratique à 2× la hauteur visée : le sommet tombe à [lift].
    final upperLid = Path()
      ..moveTo(left.dx, left.dy)
      ..quadraticBezierTo(center.dx, center.dy - 2 * upperLift, right.dx, right.dy);
    final lowerLid = Path()
      ..moveTo(left.dx, left.dy)
      ..quadraticBezierTo(center.dx, center.dy + 2 * lowerLift, right.dx, right.dy);

    if (openness > 0) {
      final almond = Path()
        ..moveTo(left.dx, left.dy)
        ..quadraticBezierTo(
            center.dx, center.dy - 2 * upperLift, right.dx, right.dy)
        ..quadraticBezierTo(
            center.dx, center.dy + 2 * lowerLift, left.dx, left.dy)
        ..close();
      canvas.save();
      canvas.clipPath(almond);
      canvas.drawPath(
        almond,
        Paint()..color = colors.open.withValues(alpha: 0.12 * openness),
      );
      _paintIris(canvas, center, maxLift * 0.95 * irisScale);
      canvas.restore();
    }

    final stroke = math.max(1.5, side * 0.08);
    final lidPaint = Paint()
      ..color = Color.lerp(colors.closed, colors.outline, openness)!
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(lowerLid, lidPaint..strokeWidth = stroke * 0.75);
    canvas.drawPath(upperLid, lidPaint..strokeWidth = stroke);

    _paintSparkles(canvas, side);
  }

  /// Iris au remplissage pâle ; contours iris / pupille en ambre plein.
  void _paintIris(Canvas canvas, Offset center, double radius) {
    if (radius <= 0) return;
    final outlineWidth = math.max(1.0, radius * 0.14);
    canvas.drawCircle(center, radius, Paint()..color = colors.open);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = colors.outline
        ..style = PaintingStyle.stroke
        ..strokeWidth = outlineWidth,
    );
    final dotPaint = Paint()..color = colors.center.withValues(alpha: 0.8);
    final ringRadius = radius * 0.62;
    final dotRadius = math.max(0.5, radius * 0.09);
    for (var index = 0; index < _irisDots; index++) {
      final angle = 2 * math.pi * index / _irisDots;
      canvas.drawCircle(
        center + Offset(math.cos(angle), math.sin(angle)) * ringRadius,
        dotRadius,
        dotPaint,
      );
    }
    final pupilRadius = radius * 0.28;
    canvas.drawCircle(center, pupilRadius, Paint()..color = colors.center);
    canvas.drawCircle(
      center,
      pupilRadius,
      Paint()
        ..color = colors.outline
        ..style = PaintingStyle.stroke
        ..strokeWidth = math.max(1.0, outlineWidth * 0.85),
    );
  }

  /// Halo qui gonfle et s'éteint une fois derrière l'œil.
  void _paintHalo(Canvas canvas, Offset center, double side) {
    final phase = _haloWindow.transform(progress.value);
    if (phase <= 0 || phase >= 1) return;
    final pulse = math.sin(math.pi * phase);
    final halo = colors.halo;
    canvas.drawCircle(
      center,
      side * (0.32 + 0.16 * phase),
      Paint()
        ..color = halo.withValues(alpha: halo.a * pulse)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, side * 0.06),
    );
  }

  /// Paillettes multicolores qui scintillent une fois en fin d'ouverture.
  void _paintSparkles(Canvas canvas, double side) {
    final phase = _sparkleWindow.transform(progress.value);
    if (phase <= 0 || phase >= 1) return;
    final twinkle = math.sin(math.pi * phase);
    final palette = colors.sparkles;
    if (palette.isEmpty) return;
    // Positions relatives (coin haut-droit) + taille relative de chaque étoile.
    const specs = [
      (0.78, 0.12, 0.16),
      (0.94, 0.28, 0.10),
      (0.62, 0.08, 0.09),
      (0.88, 0.02, 0.07),
    ];
    for (var index = 0; index < specs.length; index++) {
      final (x, y, scale) = specs[index];
      // Décalage léger pour que les couleurs ne clignotent pas toutes ensemble.
      final localTwinkle =
          math.sin(math.pi * (phase * 0.85 + index * 0.08).clamp(0.0, 1.0));
      final strength = twinkle * localTwinkle;
      if (strength <= 0) continue;
      _paintStar(
        canvas,
        Offset(side * x, side * y),
        side * scale * strength,
        palette[index % palette.length].withValues(alpha: strength),
      );
    }
  }

  /// Étoile à 4 branches centrée en [center], rayon extérieur [outer].
  void _paintStar(Canvas canvas, Offset center, double outer, Color color) {
    if (outer <= 0) return;
    final inner = outer * 0.28;
    final star = Path();
    for (var point = 0; point < 8; point++) {
      final radius = point.isEven ? outer : inner;
      final angle = -math.pi / 2 + point * math.pi / 4;
      final vertex =
          center + Offset(math.cos(angle), math.sin(angle)) * radius;
      if (point == 0) {
        star.moveTo(vertex.dx, vertex.dy);
      } else {
        star.lineTo(vertex.dx, vertex.dy);
      }
    }
    star.close();
    canvas.drawPath(star, Paint()..color = color);
  }

  @override
  bool shouldRepaint(SeenEyePainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.colors != colors;
}
