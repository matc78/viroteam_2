import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Signal hérité : fond rouge jour J échéance cotisation.
class FeeDeadlineBackground extends InheritedWidget {
  const FeeDeadlineBackground({
    super.key,
    required this.active,
    required super.child,
  });

  final bool active;

  static bool of(BuildContext context) {
    return context
            .dependOnInheritedWidgetOfExactType<FeeDeadlineBackground>()
            ?.active ??
        false;
  }

  @override
  bool updateShouldNotify(FeeDeadlineBackground oldWidget) {
    return active != oldWidget.active;
  }
}

/// Scaffold fond blanc avec formes décoratives colorées (accord portail web).
class ViroScaffold extends StatelessWidget {
  const ViroScaffold({
    super.key,
    this.appBar,
    required this.body,
    this.floatingActionButton,
  });

  final PreferredSizeWidget? appBar;
  final Widget body;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final feeDeadlineUrgent = FeeDeadlineBackground.of(context);
    final backgroundColor = feeDeadlineUrgent
        ? Color.lerp(ViroColors.white, ViroColors.error, 0.1)!
        : ViroColors.white;

    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      body: Stack(
        fit: StackFit.expand,
        children: [
          _DecorShapes(feeDeadlineUrgent: feeDeadlineUrgent),
          body,
        ],
      ),
    );
  }
}

/// Formes décoratives d'arrière-plan — reproduit le DecorShapes du portail web.
class _DecorShapes extends StatelessWidget {
  const _DecorShapes({this.feeDeadlineUrgent = false});

  final bool feeDeadlineUrgent;

  @override
  Widget build(BuildContext context) {
    if (feeDeadlineUrgent) {
      return IgnorePointer(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                ViroColors.error.withValues(alpha: 0.06),
                ViroColors.error.withValues(alpha: 0.03),
              ],
            ),
          ),
        ),
      );
    }

    final size = MediaQuery.sizeOf(context);
    final w = size.width;
    final h = size.height;

    return IgnorePointer(
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Cercle bleu clair — déborde haut-droite
          Positioned(
            top: -40,
            right: -30,
            child: _Circle(diameter: 120, color: ViroColors.primary50.withValues(alpha: 0.45)),
          ),
          // Cercle orange — bord gauche
          Positioned(
            top: h * 0.38,
            left: -20,
            child: _Circle(diameter: 56, color: ViroColors.sportOrange.withValues(alpha: 0.12)),
          ),
          // Cercle vert — déborde bas-gauche
          Positioned(
            bottom: -30,
            left: -20,
            child: _Circle(diameter: 80, color: ViroColors.sportGreen.withValues(alpha: 0.10)),
          ),
          // Cercle cyan — bord gauche haut
          Positioned(
            top: h * 0.15,
            left: -10,
            child: _Circle(diameter: 50, color: ViroColors.sportCyan.withValues(alpha: 0.10)),
          ),
          // Anneau bleu — bord droite
          Positioned(
            top: h * 0.55,
            right: -24,
            child: _Ring(diameter: 80, color: ViroColors.primary200.withValues(alpha: 0.30)),
          ),
          // Anneau orange — coin haut-gauche
          Positioned(
            top: h * 0.08,
            left: -12,
            child: _Ring(diameter: 44, color: ViroColors.sportOrange.withValues(alpha: 0.18)),
          ),
          // Petit cercle bleu — bas-droite
          Positioned(
            bottom: h * 0.15,
            right: -8,
            child: _Circle(diameter: 36, color: ViroColors.primary100.withValues(alpha: 0.30)),
          ),
          // Dot cyan
          Positioned(
            top: h * 0.28,
            right: w - 16,
            child: _Circle(diameter: 10, color: ViroColors.sportCyan.withValues(alpha: 0.40)),
          ),
          // Dot jaune
          Positioned(
            top: h * 0.72,
            right: -4,
            child: _Circle(diameter: 8, color: ViroColors.sportYellow.withValues(alpha: 0.50)),
          ),
          // Dot orange
          Positioned(
            top: h * 0.45,
            right: -6,
            child: _Circle(diameter: 12, color: ViroColors.sportOrange.withValues(alpha: 0.30)),
          ),
          // Arc vert — haut-droite (quart de cercle)
          Positioned(
            top: h * 0.03,
            right: -40,
            child: Transform.rotate(
              angle: 0.44,
              child: _Arc(diameter: 140, color: ViroColors.sportGreen.withValues(alpha: 0.18)),
            ),
          ),
          // Arc cyan — bas-gauche
          Positioned(
            bottom: h * 0.05,
            left: -30,
            child: Transform.rotate(
              angle: -0.31,
              child: _Arc(diameter: 110, color: ViroColors.sportCyan.withValues(alpha: 0.20)),
            ),
          ),
          // Trait bleu oblique — bord droite milieu
          Positioned(
            top: h * 0.35,
            right: -10,
            child: Transform.rotate(
              angle: -0.6,
              child: Container(
                width: 60,
                height: 2,
                color: ViroColors.primary200.withValues(alpha: 0.28),
              ),
            ),
          ),
          // Trait orange oblique — bord gauche
          Positioned(
            top: h * 0.50,
            left: -8,
            child: Transform.rotate(
              angle: 0.4,
              child: Container(
                width: 44,
                height: 2,
                color: ViroColors.sportOrange.withValues(alpha: 0.20),
              ),
            ),
          ),
          // Pill — coin bas-droite
          Positioned(
            bottom: h * 0.06,
            right: -14,
            child: Transform.rotate(
              angle: -0.49,
              child: Container(
                width: 48,
                height: 16,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: ViroColors.primary100.withValues(alpha: 0.25),
                ),
              ),
            ),
          ),
          // Carré jaune — bord gauche
          Positioned(
            top: h * 0.60,
            left: -8,
            child: Transform.rotate(
              angle: 0.31,
              child: Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: ViroColors.sportYellow.withValues(alpha: 0.16),
                ),
              ),
            ),
          ),
          // Confettis sparses (comme DecorShapes du portail)
          for (final piece in _confettiPieces)
            if (!piece.sparse || w >= 700)
              Positioned(
                top: h * piece.topFraction,
                left: w * piece.leftFraction,
                child: Opacity(
                  opacity: 0.85,
                  child: Transform.rotate(
                    angle: piece.rotateRadians,
                    child: _ConfettiShape(
                      kind: piece.kind,
                      size: piece.size,
                      color: piece.color,
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

enum _ConfettiKind { dot, dash, sq, diamond }

enum _ConfettiSize { sm, md }

enum _ConfettiColor { cyan, yellow, green, blue }

/// Définition d'un confetti positionné en fractions de l'écran.
class _ConfettiSpec {
  const _ConfettiSpec({
    required this.kind,
    required this.topFraction,
    required this.leftFraction,
    required this.colorKey,
    this.size = _ConfettiSize.sm,
    this.rotateDegrees = 0,
    this.sparse = false,
  });

  final _ConfettiKind kind;
  final double topFraction;
  final double leftFraction;
  final _ConfettiColor colorKey;
  final _ConfettiSize size;
  final double rotateDegrees;
  final bool sparse;

  double get rotateRadians => rotateDegrees * math.pi / 180;

  /// Couleur semi-transparente alignée sur le CSS du portail.
  Color get color => switch (colorKey) {
        _ConfettiColor.cyan => ViroColors.sportCyan.withValues(alpha: 0.55),
        _ConfettiColor.yellow => ViroColors.sportYellow.withValues(alpha: 0.65),
        _ConfettiColor.green => ViroColors.sportGreen.withValues(alpha: 0.45),
        _ConfettiColor.blue => ViroColors.primary200.withValues(alpha: 0.60),
      };
}

/// Positions alignées sur le portail (`DecorShapes.tsx`).
const _confettiPieces = <_ConfettiSpec>[
  _ConfettiSpec(
    kind: _ConfettiKind.dot,
    topFraction: 0.06,
    leftFraction: 0.08,
    colorKey: _ConfettiColor.cyan,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.sq,
    topFraction: 0.05,
    leftFraction: 0.71,
    colorKey: _ConfettiColor.yellow,
    rotateDegrees: 18,
    sparse: true,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.diamond,
    topFraction: 0.14,
    leftFraction: 0.42,
    colorKey: _ConfettiColor.blue,
    rotateDegrees: 45,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.dot,
    topFraction: 0.21,
    leftFraction: 0.04,
    colorKey: _ConfettiColor.yellow,
    sparse: true,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.dash,
    topFraction: 0.31,
    leftFraction: 0.16,
    colorKey: _ConfettiColor.blue,
    rotateDegrees: 48,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.sq,
    topFraction: 0.41,
    leftFraction: 0.67,
    colorKey: _ConfettiColor.cyan,
    rotateDegrees: 8,
    sparse: true,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.dot,
    topFraction: 0.48,
    leftFraction: 0.84,
    colorKey: _ConfettiColor.blue,
    size: _ConfettiSize.md,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.dash,
    topFraction: 0.55,
    leftFraction: 0.27,
    colorKey: _ConfettiColor.yellow,
    rotateDegrees: 15,
    sparse: true,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.dot,
    topFraction: 0.62,
    leftFraction: 0.12,
    colorKey: _ConfettiColor.cyan,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.diamond,
    topFraction: 0.68,
    leftFraction: 0.39,
    colorKey: _ConfettiColor.blue,
    rotateDegrees: 40,
    sparse: true,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.sq,
    topFraction: 0.74,
    leftFraction: 0.21,
    colorKey: _ConfettiColor.cyan,
    rotateDegrees: 28,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.diamond,
    topFraction: 0.84,
    leftFraction: 0.81,
    colorKey: _ConfettiColor.cyan,
    rotateDegrees: 30,
    sparse: true,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.dash,
    topFraction: 0.90,
    leftFraction: 0.30,
    colorKey: _ConfettiColor.blue,
    rotateDegrees: -25,
  ),
  _ConfettiSpec(
    kind: _ConfettiKind.dot,
    topFraction: 0.93,
    leftFraction: 0.58,
    colorKey: _ConfettiColor.green,
    size: _ConfettiSize.md,
    sparse: true,
  ),
];

/// Petite forme de confetti (point, tiret, carré, losange).
class _ConfettiShape extends StatelessWidget {
  const _ConfettiShape({
    required this.kind,
    required this.size,
    required this.color,
  });

  final _ConfettiKind kind;
  final _ConfettiSize size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isMd = size == _ConfettiSize.md;
    final (width, height, radius) = switch (kind) {
      _ConfettiKind.dot => (
          isMd ? 8.8 : 6.4,
          isMd ? 8.8 : 6.4,
          999.0,
        ),
      _ConfettiKind.dash => (
          isMd ? 16.8 : 13.6,
          isMd ? 5.1 : 4.5,
          999.0,
        ),
      _ConfettiKind.sq || _ConfettiKind.diamond => (
          isMd ? 8.8 : 7.2,
          isMd ? 8.8 : 7.2,
          kind == _ConfettiKind.diamond ? 2.4 : 3.2,
        ),
    };

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Cercle décoratif plein.
class _Circle extends StatelessWidget {
  const _Circle({required this.diameter, required this.color});
  final double diameter;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}

/// Anneau décoratif (bordure sans remplissage).
class _Ring extends StatelessWidget {
  const _Ring({required this.diameter, required this.color});
  final double diameter;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 2),
      ),
    );
  }
}

/// Arc décoratif (demi-anneau ouvert, style trait courbe).
class _Arc extends StatelessWidget {
  const _Arc({required this.diameter, required this.color});
  final double diameter;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(diameter, diameter),
      painter: _ArcPainter(color: color),
    );
  }
}

class _ArcPainter extends CustomPainter {
  const _ArcPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final rect = Offset.zero & size;
    canvas.drawArc(rect, 0.3, 2.2, false, paint);
  }

  @override
  bool shouldRepaint(covariant _ArcPainter oldDelegate) => color != oldDelegate.color;
}

/// AppBar légère — fond blanc, texte bleu foncé.
class ViroAppBar extends StatelessWidget implements PreferredSizeWidget {
  const ViroAppBar({
    super.key,
    this.title,
    this.actions,
    this.leading,
    this.onTitleTap,
    this.bottom,
  });

  final Widget? title;
  final List<Widget>? actions;
  final Widget? leading;
  final PreferredSizeWidget? bottom;

  /// Tap sur le titre (ex. « ViroTeam » → retour à la home globale).
  final VoidCallback? onTitleTap;

  @override
  Size get preferredSize {
    var height = ViroSpacing.topBarHeight;
    if (bottom != null) {
      height += bottom!.preferredSize.height;
    }
    return Size.fromHeight(height);
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final appBarTheme = Theme.of(context).appBarTheme;
    final titleColor =
        appBarTheme.titleTextStyle?.color ??
        appBarTheme.foregroundColor ??
        ViroColors.primary800;
    final iconColor =
        appBarTheme.iconTheme?.color ??
        appBarTheme.foregroundColor ??
        ViroColors.primary800;

    return AppBar(
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: ViroColors.white,
      surfaceTintColor: Colors.transparent,
      foregroundColor: iconColor,
      leading: leading,
      actions: actions,
      title: title == null
          ? null
          : onTitleTap == null
              ? title
              : InkWell(
                  onTap: onTitleTap,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: DefaultTextStyle(
                      style: textTheme.titleMedium!.copyWith(
                        color: titleColor,
                        fontWeight: FontWeight.w700,
                      ),
                      child: title!,
                    ),
                  ),
                ),
      titleTextStyle: textTheme.titleMedium?.copyWith(
        color: titleColor,
        fontWeight: FontWeight.w700,
      ),
      bottom: bottom,
      flexibleSpace: DecoratedBox(
        decoration: BoxDecoration(
          color: ViroColors.white,
          border: Border(
            bottom: BorderSide(
              color: ViroColors.primary200.withValues(alpha: 0.2),
            ),
          ),
        ),
      ),
    );
  }
}

