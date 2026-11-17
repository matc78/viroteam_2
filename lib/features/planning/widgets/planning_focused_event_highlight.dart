import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/home/models/rsvp_push_highlight.dart';

/// Encadre la tuile d'un event ouvert depuis une notif.
///
/// Par défaut : liseré bref puis fondu, tuile défilée à l'écran (planning
/// club). [blinking] : liseré qui clignote tant que le widget est affiché, le
/// parent décide quand le retirer (home après une push RSVP) ; fixe si les
/// animations sont désactivées. [scrollIntoView] : faux pour ne pas faire
/// défiler vers chaque tuile quand plusieurs sont encadrées.
/// [onOffscreenChanged] : signale si la tuile est hors viewport (flèches home).
class PlanningFocusedEventHighlight extends StatefulWidget {
  const PlanningFocusedEventHighlight({
    super.key,
    required this.color,
    required this.child,
    this.blinking = false,
    this.scrollIntoView = true,
    this.onOffscreenChanged,
  });

  final Color color;
  final Widget child;
  final bool blinking;
  final bool scrollIntoView;

  /// `null` = à l'écran (ou plus suivi) ; sinon haut / bas + [reveal] pour y
  /// défiler.
  final void Function(
    RsvpHighlightOffscreenSide? side, {
    VoidCallback? reveal,
  })? onOffscreenChanged;

  @override
  State<PlanningFocusedEventHighlight> createState() =>
      _PlanningFocusedEventHighlightState();
}

class _PlanningFocusedEventHighlightState
    extends State<PlanningFocusedEventHighlight>
    with SingleTickerProviderStateMixin {
  bool _visible = true;
  ScrollPosition? _scrollPosition;
  RsvpHighlightOffscreenSide? _lastOffscreenSide;
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
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _updateOffscreen();
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _bindScrollPosition();
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
  void didUpdateWidget(covariant PlanningFocusedEventHighlight oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.onOffscreenChanged != null &&
        widget.onOffscreenChanged == null) {
      oldWidget.onOffscreenChanged!(null);
      _lastOffscreenSide = null;
    }
  }

  @override
  void dispose() {
    _scrollPosition?.removeListener(_scheduleOffscreenCheck);
    if (widget.blinking) widget.onOffscreenChanged?.call(null);
    _blink.dispose();
    super.dispose();
  }

  /// Suit le scroll parent pour savoir si la tuile sort du viewport.
  void _bindScrollPosition() {
    if (!widget.blinking || widget.onOffscreenChanged == null) return;
    final position = Scrollable.maybeOf(context)?.position;
    if (identical(position, _scrollPosition)) return;
    _scrollPosition?.removeListener(_scheduleOffscreenCheck);
    _scrollPosition = position;
    _scrollPosition?.addListener(_scheduleOffscreenCheck);
    _scheduleOffscreenCheck();
  }

  void _scheduleOffscreenCheck() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updateOffscreen();
    });
  }

  /// Détermine si la tuile est entièrement au-dessus ou en dessous du viewport.
  void _updateOffscreen() {
    final callback = widget.onOffscreenChanged;
    if (!widget.blinking || callback == null) return;

    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || !box.attached) return;

    final scrollable = Scrollable.maybeOf(context);
    final viewport = scrollable?.context.findRenderObject() as RenderBox?;
    if (viewport == null || !viewport.hasSize) {
      _reportOffscreen(null);
      return;
    }

    final topLeft = box.localToGlobal(Offset.zero, ancestor: viewport);
    final itemTop = topLeft.dy;
    final itemBottom = itemTop + box.size.height;
    const edgeSlop = ViroSpacing.xs;

    final RsvpHighlightOffscreenSide? side;
    if (itemBottom <= edgeSlop) {
      side = RsvpHighlightOffscreenSide.up;
    } else if (itemTop >= viewport.size.height - edgeSlop) {
      side = RsvpHighlightOffscreenSide.down;
    } else {
      side = null;
    }
    _reportOffscreen(side);
  }

  void _reportOffscreen(RsvpHighlightOffscreenSide? side) {
    final callback = widget.onOffscreenChanged;
    if (callback == null) return;
    if (side == _lastOffscreenSide && side == null) return;
    if (side == _lastOffscreenSide && side != null) {
      // Rafraîchit le [reveal] (context éventuellement reconstruit).
      callback(side, reveal: _revealSelf);
      return;
    }
    _lastOffscreenSide = side;
    callback(
      side,
      reveal: side == null ? null : _revealSelf,
    );
  }

  void _revealSelf() {
    if (!mounted) return;
    Scrollable.ensureVisible(
      context,
      alignment: 0.25,
      duration: ViroMotion.standard,
      curve: ViroMotion.enter,
    );
  }

  /// Opacité du liseré / halo pour une valeur de clignotement ∈ [0, 1].
  double _blinkOpacity(double t) =>
      ViroMotion.rsvpHighlightBlinkMinOpacity +
      (1 - ViroMotion.rsvpHighlightBlinkMinOpacity) *
          ViroMotion.exit.transform(t);

  /// Opacité du voile coloré sur la tuile (suit le clignotement).
  double _fillOpacity(double borderOpacity) =>
      borderOpacity * ViroMotion.rsvpHighlightFillMaxOpacity;

  BoxDecoration _frameDecoration(double opacity) => BoxDecoration(
        borderRadius: BorderRadius.circular(
          ViroSpacing.cardRadius + ViroSpacing.xs,
        ),
        border: Border.all(
          color: widget.color.withValues(alpha: opacity),
          width: ViroMotion.rsvpHighlightBorderWidth,
        ),
        boxShadow: [
          BoxShadow(
            color: widget.color.withValues(alpha: opacity * 0.55),
            blurRadius: 14,
            spreadRadius: 1,
          ),
        ],
      );

  /// Tuile + voile teinté (vert / rouge / orange) par-dessus le fond de carte.
  Widget _tintedChild(double fillOpacity) {
    if (fillOpacity <= 0) return widget.child;
    return ClipRRect(
      borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
      child: Stack(
        children: [
          widget.child,
          Positioned.fill(
            child: IgnorePointer(
              child: ColoredBox(
                color: widget.color.withValues(alpha: fillOpacity),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const padding = EdgeInsets.all(ViroSpacing.xs / 2);
    if (widget.blinking) {
      return AnimatedBuilder(
        animation: _blink,
        builder: (context, child) {
          final opacity = _blinkOpacity(_blink.value);
          return DecoratedBox(
            decoration: _frameDecoration(opacity),
            child: Padding(
              padding: padding,
              child: _tintedChild(_fillOpacity(opacity)),
            ),
          );
        },
      );
    }
    final frameOpacity = _visible ? widget.color.a : 0.0;
    return AnimatedContainer(
      duration: ViroMotion.focusHighlightFade,
      curve: ViroMotion.exit,
      decoration: _frameDecoration(frameOpacity),
      padding: padding,
      child: _tintedChild(_fillOpacity(frameOpacity)),
    );
  }
}
