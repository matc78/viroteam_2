import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Encadre brièvement la tuile de l’event ouvert depuis une notif, la fait
/// défiler à l’écran, puis s’efface.
class PlanningFocusedEventHighlight extends StatefulWidget {
  const PlanningFocusedEventHighlight({
    super.key,
    required this.color,
    required this.child,
  });

  final Color color;
  final Widget child;

  @override
  State<PlanningFocusedEventHighlight> createState() =>
      _PlanningFocusedEventHighlightState();
}

class _PlanningFocusedEventHighlightState
    extends State<PlanningFocusedEventHighlight> {
  bool _visible = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Scrollable.ensureVisible(
        context,
        alignment: 0.2,
        duration: ViroMotion.standard,
        curve: ViroMotion.enter,
      );
    });
    Future<void>.delayed(ViroMotion.focusHighlightHold, () {
      if (mounted) setState(() => _visible = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: ViroMotion.focusHighlightFade,
      curve: ViroMotion.exit,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(
          ViroSpacing.cardRadius + ViroSpacing.xs,
        ),
        border: Border.all(
          color: _visible ? widget.color : widget.color.withValues(alpha: 0),
          width: 2,
        ),
      ),
      padding: const EdgeInsets.all(ViroSpacing.xs / 2),
      child: widget.child,
    );
  }
}
