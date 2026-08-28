import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';

/// En-tête de progression discret : fine barre sous l'AppBar.
class SetupProgressHeader extends StatelessWidget implements PreferredSizeWidget {
  const SetupProgressHeader({
    super.key,
    required this.currentStep,
    required this.totalSteps,
  });

  final int currentStep;
  final int totalSteps;

  static const _stepColors = [
    ViroColors.sportGreen,
    ViroColors.sportCyan,
    ViroColors.sportOrange,
    ViroColors.sportYellow,
    ViroColors.primary400,
    ViroColors.adminBadgeEnd,
  ];

  @override
  Size get preferredSize => const Size.fromHeight(3);

  @override
  Widget build(BuildContext context) {
    final progress = (currentStep + 1) / totalSteps;
    final activeColor = _stepColors[currentStep % _stepColors.length];

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: progress),
      duration: ViroMotion.standard,
      curve: ViroMotion.enter,
      builder: (context, value, _) {
        return LinearProgressIndicator(
          value: value,
          minHeight: 3,
          backgroundColor: ViroColors.primary50,
          color: activeColor,
        );
      },
    );
  }
}
