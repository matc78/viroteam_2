import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/planning_calendar_range.dart';

/// Sélecteur Jour / Semaine / Mois du planning club (coach-admin).
class PlanningViewModeSwitcher extends StatelessWidget {
  const PlanningViewModeSwitcher({
    super.key,
    required this.mode,
    required this.onChanged,
  });

  final PlanningViewMode mode;
  final ValueChanged<PlanningViewMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.screenHorizontal,
      ),
      child: SegmentedButton<PlanningViewMode>(
        showSelectedIcon: false,
        segments: [
          ButtonSegment(
            value: PlanningViewMode.day,
            label: Text(AppCopy.planning.viewModeDay),
          ),
          ButtonSegment(
            value: PlanningViewMode.week,
            label: Text(AppCopy.planning.viewModeWeek),
          ),
          ButtonSegment(
            value: PlanningViewMode.month,
            label: Text(AppCopy.planning.viewModeMonth),
          ),
        ],
        selected: {mode},
        onSelectionChanged: (selected) => onChanged(selected.first),
      ),
    );
  }
}
