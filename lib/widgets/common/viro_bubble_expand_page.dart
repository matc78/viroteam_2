import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';

/// Page avec révélation circulaire depuis [origin] (ex. bulle chat home).
///
/// Si [origin] est null, l’animation part du coin bas-droit (emplacement typique
/// de la bulle sur la home).
class ViroBubbleExpandPage<T> extends CustomTransitionPage<T> {
  ViroBubbleExpandPage({
    required super.child,
    super.name,
    super.arguments,
    super.restorationId,
    super.key,
    this.origin,
  }) : super(
          transitionDuration: ViroMotion.modal,
          reverseTransitionDuration: ViroMotion.standard,
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return _BubbleExpandTransition(
              animation: animation,
              origin: origin,
              child: child,
            );
          },
        );

  /// Centre global (écran) de la bulle au moment du tap.
  final Offset? origin;
}

class _BubbleExpandTransition extends StatelessWidget {
  const _BubbleExpandTransition({
    required this.animation,
    required this.child,
    this.origin,
  });

  final Animation<double> animation;
  final Widget child;
  final Offset? origin;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final fallback = Offset(size.width - 40, size.height - 56);

    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final box = context.findRenderObject() as RenderBox?;
        // Premier frame : pas encore de layout → origin globale ≈ locale (plein écran).
        final Offset center;
        if (origin == null) {
          center = fallback;
        } else if (box != null && box.hasSize) {
          center = box.globalToLocal(origin!);
        } else {
          center = origin!;
        }

        final revealT = animation.status == AnimationStatus.reverse
            ? ViroMotion.exit.transform(animation.value)
            : ViroMotion.enter.transform(animation.value);
        final fadeT = animation.status == AnimationStatus.reverse
            ? const Interval(0, 0.55, curve: Curves.easeIn)
                .transform(animation.value)
            : const Interval(0.28, 1, curve: Curves.easeOut)
                .transform(animation.value);

        return Stack(
          fit: StackFit.expand,
          children: [
            // Halo de la bulle qui grossit (avant que le contenu ne prenne le relais).
            IgnorePointer(
              child: CustomPaint(
                painter: _BubbleHaloPainter(
                  center: center,
                  fraction: revealT,
                  maxRadius: _maxRadius(size, center),
                ),
              ),
            ),
            ClipPath(
              clipper: _CircleRevealClipper(
                center: center,
                fraction: revealT,
                maxRadius: _maxRadius(size, center),
              ),
              child: Opacity(
                opacity: fadeT.clamp(0.0, 1.0),
                child: child,
              ),
            ),
          ],
        );
      },
    );
  }

  static double _maxRadius(Size size, Offset center) {
    final corners = [
      Offset.zero,
      Offset(size.width, 0),
      Offset(0, size.height),
      Offset(size.width, size.height),
    ];
    var maxDistance = 0.0;
    for (final corner in corners) {
      maxDistance = math.max(maxDistance, (corner - center).distance);
    }
    return maxDistance;
  }
}

class _CircleRevealClipper extends CustomClipper<Path> {
  _CircleRevealClipper({
    required this.center,
    required this.fraction,
    required this.maxRadius,
  });

  final Offset center;
  final double fraction;
  final double maxRadius;

  @override
  Path getClip(Size size) {
    final radius = maxRadius * fraction.clamp(0.0, 1.0);
    return Path()..addOval(Rect.fromCircle(center: center, radius: radius));
  }

  @override
  bool shouldReclip(_CircleRevealClipper oldClipper) {
    return oldClipper.center != center ||
        oldClipper.fraction != fraction ||
        oldClipper.maxRadius != maxRadius;
  }
}

/// Disque teinté qui grossit comme la bulle avant le fade du contenu.
class _BubbleHaloPainter extends CustomPainter {
  _BubbleHaloPainter({
    required this.center,
    required this.fraction,
    required this.maxRadius,
  });

  final Offset center;
  final double fraction;
  final double maxRadius;

  @override
  void paint(Canvas canvas, Size size) {
    if (fraction <= 0) return;
    // Disparaît quand le contenu est déjà bien visible.
    final opacity = (1 - ((fraction - 0.45) / 0.55).clamp(0.0, 1.0)) * 0.95;
    if (opacity <= 0) return;

    final radius = maxRadius * fraction.clamp(0.0, 1.0);
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [
          ViroColors.white.withValues(alpha: opacity),
          ViroColors.primary50.withValues(alpha: opacity * 0.9),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, paint);
  }

  @override
  bool shouldRepaint(_BubbleHaloPainter oldDelegate) {
    return oldDelegate.center != center ||
        oldDelegate.fraction != fraction ||
        oldDelegate.maxRadius != maxRadius;
  }
}
