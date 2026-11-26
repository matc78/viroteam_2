import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';

/// Couleur du badge de rang : or, argent, bronze, chocolat, puis
/// [clubColor] à partir de la 5e place.
Color rankBadgeColor(int rank, Color clubColor) => switch (rank) {
  1 => ViroColors.rankGold,
  2 => ViroColors.rankSilver,
  3 => ViroColors.rankBronze,
  4 => ViroColors.rankChocolate,
  _ => clubColor,
};

/// Fond opaque d'une ligne de classement médaillée (1re à 4e place) :
/// teinte de la médaille posée sur la surface de carte. `null` au-delà.
Color? rankRowBackground(int rank, ViroPalette palette) {
  if (rank < 1 || rank > 4) return null;
  final medal = rankBadgeColor(rank, palette.accent);
  return Color.alphaBlend(
    medal.withValues(alpha: palette.isDark ? 0.24 : 0.17),
    palette.surfaceCard,
  );
}

/// Pastille de position au classement, colorée par [rankBadgeColor], avec
/// un rendu métallique (dégradé, reflet, halo). Sur le podium, un éclat la
/// traverse une fois à l'apparition (sauf animations réduites).
/// Décorative : le libellé accessible est porté par le parent.
class ViroRankBadge extends StatefulWidget {
  const ViroRankBadge({
    super.key,
    required this.rank,
    required this.clubColor,
    this.size = 20,
    this.shine = true,
  });

  final int rank;
  final Color clubColor;
  final double size;

  /// Éclat à l'apparition (podium seulement).
  final bool shine;

  @override
  State<ViroRankBadge> createState() => _ViroRankBadgeState();
}

class _ViroRankBadgeState extends State<ViroRankBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shine = AnimationController(
    vsync: this,
    duration: ViroMotion.rankShineDelay + ViroMotion.rankShine,
  );

  bool get _wantsShine => widget.shine && widget.rank >= 1 && widget.rank <= 3;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (_wantsShine &&
        !reduceMotion &&
        !_shine.isAnimating &&
        _shine.value == 0) {
      _shine.forward();
    }
  }

  @override
  void dispose() {
    _shine.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final fill = rankBadgeColor(widget.rank, widget.clubColor);
    final ink = fill.computeLuminance() > 0.45
        ? ViroColors.brandInkOnVivid
        : ViroColors.white;
    final light = Color.lerp(fill, ViroColors.white, 0.35)!;
    final dark = Color.lerp(fill, ViroColors.inkOnVivid, 0.18)!;
    final radius = BorderRadius.circular(size);
    final delayShare =
        ViroMotion.rankShineDelay.inMilliseconds /
        _shine.duration!.inMilliseconds;

    return ExcludeSemantics(
      child: Container(
        constraints: BoxConstraints(minWidth: size, minHeight: size),
        // Rond jusqu'à 9, pilule ensuite.
        padding: EdgeInsets.symmetric(
          horizontal: widget.rank < 10 ? 0 : size * 0.22,
        ),
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [light, fill, dark],
            stops: const [0, 0.5, 1],
          ),
          border: Border.all(
            color: ViroColors.white.withValues(alpha: 0.45),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: fill.withValues(alpha: 0.5),
              blurRadius: size * 0.4,
              offset: Offset(0, size * 0.08),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: radius,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Reflet haut, façon métal poli.
              Positioned(
                top: 0,
                left: size * 0.15,
                right: size * 0.15,
                height: size * 0.42,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.vertical(
                      bottom: Radius.circular(size),
                    ),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        ViroColors.white.withValues(alpha: 0.45),
                        ViroColors.white.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
              Text(
                '${widget.rank}',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: ink,
                  fontWeight: FontWeight.w900,
                  fontSize: size * 0.55,
                  height: 1,
                  shadows: [
                    Shadow(
                      color: dark.withValues(alpha: 0.35),
                      blurRadius: 1,
                      offset: const Offset(0, 0.5),
                    ),
                  ],
                ),
              ),
              if (_wantsShine)
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: _shine,
                    builder: (context, _) {
                      final t = Interval(
                        delayShare,
                        1,
                        curve: ViroMotion.enter,
                      ).transform(_shine.value);
                      if (t <= 0 || t >= 1) return const SizedBox.shrink();
                      return FractionalTranslation(
                        translation: Offset(-1.2 + 2.4 * t, 0),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: [
                                ViroColors.white.withValues(alpha: 0),
                                ViroColors.white.withValues(alpha: 0.75),
                                ViroColors.white.withValues(alpha: 0),
                              ],
                              transform: const GradientRotation(0.5),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
