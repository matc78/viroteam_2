import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Encadre la tuile d'un event ouvert depuis une notif.
///
/// Par défaut : liseré bref puis fondu, tuile défilée à l'écran (planning
/// club). [blinking] : liseré qui clignote tant que le widget est affiché, le
/// parent décide quand le retirer (home après une push RSVP) ; fixe si les
/// animations sont désactivées. [scrollIntoView] : faux pour ne pas faire
/// défiler vers chaque tuile quand plusieurs sont encadrées.
class PlanningFocusedEventHighlight extends StatefulWidget {
  const PlanningFocusedEventHighlight({
    super.key,
    required this.color,
    required this.child,
    this.blinking = false,
    this.scrollIntoView = true,
  });

  final Color color;
  final Widget child;
  final bool blinking;
  final bool scrollIntoView;

  @override
  State<PlanningFocusedEventHighlight> createState() =>
      _PlanningFocusedEventHighlightState();
}

class _PlanningFocusedEventHighlightState
    extends State<PlanningFocusedEventHighlight>
    with SingleTickerProviderStateMixin {
  bool _visible = true;
  late final AnimationController _blink = AnimationController(
    vsync: this,
    duration: ViroMotion.rsvpHighlightBlink,
  );

  @override
  void initState() {
    super.initState();
    if (widget.scrollIntoView) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Scrollable.ensureVisible(
          context,
          alignment: 0.2,
          duration: ViroMotion.standard,
          curve: ViroMotion.enter,
        );
      });
    }
    if (!widget.blinking) {
      Future<void>.delayed(ViroMotion.focusHighlightHold, () {
        if (mounted) setState(() => _visible = false);
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!widget.blinking) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _blink
        ..stop()
        ..value = 1;
    } else if (!_blink.isAnimating) {
      _blink.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _blink.dispose();
    super.dispose();
  }

  BoxDecoration _decoration(double opacity) => BoxDecoration(
        borderRadius: BorderRadius.circular(
          ViroSpacing.cardRadius + ViroSpacing.xs,
        ),
        border: Border.all(
          color: widget.color.withValues(alpha: opacity),
          width: 2,
        ),
      );

  @override
  Widget build(BuildContext context) {
    const padding = EdgeInsets.all(ViroSpacing.xs / 2);
    if (widget.blinking) {
      return AnimatedBuilder(
        animation: _blink,
        builder: (context, child) => DecoratedBox(
          decoration: _decoration(
            ViroMotion.exit.transform(_blink.value),
          ),
          child: child,
        ),
        child: Padding(padding: padding, child: widget.child),
      );
    }
    return AnimatedContainer(
      duration: ViroMotion.focusHighlightFade,
      curve: ViroMotion.exit,
      decoration: _decoration(_visible ? widget.color.a : 0),
      padding: padding,
      child: widget.child,
    );
  }
}
