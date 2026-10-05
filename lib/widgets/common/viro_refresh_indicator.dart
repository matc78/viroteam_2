import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// [RefreshIndicator] partagé — pull-to-refresh natif (feedback pendant le geste).
///
/// À coupler avec [scrollPhysics] sur le scrollable enfant pour limiter les
/// faux positifs (bounce) tout en restant refreshable avec peu de contenu.
class ViroRefreshIndicator extends StatelessWidget {
  const ViroRefreshIndicator({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  /// Physics à poser sur le [ScrollView] enfant de ce widget.
  static const scrollPhysics = AlwaysScrollableScrollPhysics(
    parent: ClampingScrollPhysics(),
  );

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: ViroColors.primary600,
      backgroundColor: ViroColors.white,
      displacement: ViroSpacing.xl,
      triggerMode: RefreshIndicatorTriggerMode.onEdge,
      child: child,
    );
  }
}
