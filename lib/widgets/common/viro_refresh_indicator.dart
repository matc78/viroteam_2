import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';

/// [RefreshIndicator] partagé — indicateur Material invisible + logo ViroTeam.
class ViroRefreshIndicator extends StatefulWidget {
  const ViroRefreshIndicator({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  State<ViroRefreshIndicator> createState() => _ViroRefreshIndicatorState();
}

class _ViroRefreshIndicatorState extends State<ViroRefreshIndicator> {
  var _refreshing = false;

  /// Lance le refresh et affiche le logo le temps de la résolution.
  Future<void> _handleRefresh() async {
    setState(() => _refreshing = true);
    try {
      await widget.onRefresh();
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: _handleRefresh,
          color: Colors.transparent,
          backgroundColor: Colors.transparent,
          displacement: ViroSpacing.xl,
          child: widget.child,
        ),
        if (_refreshing)
          Positioned(
            top: ViroSpacing.md,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Center(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: ViroColors.white,
                    shape: BoxShape.circle,
                    boxShadow: ViroMotion.floatingShadow(
                      opacity: 0.1,
                      blur: 12,
                      y: 4,
                    ),
                  ),
                  child: const Padding(
                    padding: EdgeInsets.all(ViroSpacing.sm),
                    child: ViroLogoLoader(size: 40),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
