import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Navigation précédent / suivant d'une période du planning (semaine, mois).
class PlanningPeriodHeader extends StatelessWidget {
  const PlanningPeriodHeader({
    super.key,
    required this.label,
    required this.previousTooltip,
    required this.nextTooltip,
    required this.onPrevious,
    required this.onNext,
  });

  final String label;
  final String previousTooltip;
  final String nextTooltip;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm),
      child: Row(
        children: [
          IconButton(
            tooltip: previousTooltip,
            icon: ViroIcon(ViroIcons.chevronLeft),
            onPressed: onPrevious,
          ),
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: context.viroPalette.brandText,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: nextTooltip,
            icon: ViroIcon(ViroIcons.chevronRight),
            onPressed: onNext,
          ),
        ],
      ),
    );
  }
}
