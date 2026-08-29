import 'package:flutter/material.dart';

/// Cercle uni ou bicolore (moitié gauche / moitié droite).
class BicolorCircle extends StatelessWidget {
  const BicolorCircle({
    super.key,
    required this.primary,
    this.secondary,
    this.size = 44,
    this.showDivider = true,
  });

  final Color primary;
  final Color? secondary;
  final double size;
  final bool showDivider;

  bool get isBicolor => secondary != null;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: ClipOval(
        child: isBicolor
            ? Row(
                children: [
                  Expanded(child: ColoredBox(color: primary)),
                  if (showDivider)
                    Container(width: 1, color: Colors.white.withValues(alpha: 0.65)),
                  Expanded(child: ColoredBox(color: secondary!)),
                ],
              )
            : ColoredBox(color: primary),
      ),
    );
  }
}
