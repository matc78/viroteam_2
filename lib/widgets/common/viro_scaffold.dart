import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

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
    return Scaffold(
      backgroundColor: ViroColors.white,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const _DecorShapes(),
          body,
        ],
      ),
    );
  }
}

/// Formes décoratives d'arrière-plan — reproduit le DecorShapes du portail web.
class _DecorShapes extends StatelessWidget {
  const _DecorShapes();

  @override
  Widget build(BuildContext context) {
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
        ],
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
  });

  final Widget? title;
  final List<Widget>? actions;
  final Widget? leading;

  /// Tap sur le titre (ex. « ViroTeam » → retour à la home globale).
  final VoidCallback? onTitleTap;

  @override
  Size get preferredSize => const Size.fromHeight(ViroSpacing.topBarHeight);

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return AppBar(
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: ViroColors.white,
      surfaceTintColor: Colors.transparent,
      foregroundColor: ViroColors.primary800,
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
                        color: ViroColors.primary800,
                      ),
                      child: title!,
                    ),
                  ),
                ),
      titleTextStyle: textTheme.titleMedium?.copyWith(color: ViroColors.primary800),
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

