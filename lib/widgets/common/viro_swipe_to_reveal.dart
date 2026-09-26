import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';

/// Révèle [reveal] depuis la droite pendant un swipe, puis appelle [onCommit].
///
/// Feeling aligné sur [buildViroSlideTransition] (slide + légère parallaxe).
class ViroSwipeToReveal extends StatefulWidget {
  const ViroSwipeToReveal({
    super.key,
    required this.child,
    required this.reveal,
    required this.onCommit,
    this.enabled = true,
  });

  final Widget child;
  final Widget reveal;
  final VoidCallback onCommit;
  final bool enabled;

  @override
  ViroSwipeToRevealState createState() => ViroSwipeToRevealState();
}

/// État public pour [reset] (ex. ouverture via la bulle chat).
class ViroSwipeToRevealState extends State<ViroSwipeToReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress;

  /// Fraction d’écran ou vitesse pour valider l’ouverture.
  static const double _commitProgress = 0.28;
  static const double _commitVelocity = 700;

  /// Parallaxe home — alignée sur [buildViroSlideTransition].
  static const double _parallax = 0.08;

  bool _committing = false;

  @override
  void initState() {
    super.initState();
    _progress = AnimationController(vsync: this, value: 0);
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  /// Remet le reveal à zéro (ex. ouverture via la bulle chat).
  void reset() {
    _committing = false;
    _progress.stop();
    _progress.value = 0;
  }

  void _onDragUpdate(DragUpdateDetails details) {
    if (!widget.enabled || _committing) return;
    final width = MediaQuery.sizeOf(context).width;
    if (width <= 0) return;

    final delta = details.primaryDelta ?? 0;
    // Au repos : uniquement swipe vers la gauche (doigt qui va à gauche).
    if (_progress.value == 0 && delta >= 0) return;

    _progress.value = (_progress.value - delta / width).clamp(0.0, 1.0);
  }

  Future<void> _onDragEnd(DragEndDetails details) async {
    if (!widget.enabled || _committing) return;
    if (_progress.value == 0) return;

    final velocity = details.primaryVelocity ?? 0;
    final shouldCommit =
        _progress.value >= _commitProgress || velocity < -_commitVelocity;

    if (shouldCommit) {
      await _commit();
    } else {
      await _progress.animateTo(
        0,
        duration: ViroMotion.standard,
        curve: ViroMotion.exit,
      );
    }
  }

  Future<void> _commit() async {
    if (_committing) return;
    _committing = true;
    await _progress.animateTo(
      1,
      duration: ViroMotion.drillIn,
      curve: ViroMotion.enter,
    );
    if (!mounted) return;
    widget.onCommit();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _progress.value = 0;
      _committing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;

    return AnimatedBuilder(
      animation: _progress,
      builder: (context, _) {
        final t = _progress.value;
        final width = MediaQuery.sizeOf(context).width;
        final revealing = t > 0;

        return GestureDetector(
          onHorizontalDragUpdate: _onDragUpdate,
          onHorizontalDragEnd: _onDragEnd,
          behavior: HitTestBehavior.translucent,
          child: Stack(
            fit: StackFit.expand,
            clipBehavior: Clip.hardEdge,
            children: [
              Transform.translate(
                offset: Offset(-width * _parallax * t, 0),
                child: widget.child,
              ),
              if (revealing)
                Transform.translate(
                  offset: Offset(width * (1 - t), 0),
                  child: IgnorePointer(
                    ignoring: t < 1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        boxShadow: ViroMotion.floatingShadow(
                          opacity: 0.12 * t,
                          blur: 24,
                          y: 0,
                        ),
                      ),
                      child: widget.reveal,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
