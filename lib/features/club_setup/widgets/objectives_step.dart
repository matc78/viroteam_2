import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/objective_tile.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';

/// Étape objectifs — priorités produit et taille du club.
class ObjectivesStep extends StatelessWidget {
  const ObjectivesStep({
    super.key,
    required this.selected,
    required this.memberCountRange,
    required this.onToggle,
    required this.onMemberCountChanged,
  });

  final Set<String> selected;
  final String? memberCountRange;
  final void Function(String key) onToggle;
  final void Function(String? range) onMemberCountChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return SetupStepShell(
      subtitle:
          'Sélectionnez ce qui compte le plus — vous pourrez tout utiliser ensuite.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.center,
            spacing: ViroSpacing.sm,
            runSpacing: ViroSpacing.sm,
            children: ClubObjectives.all
                .map(
                  (objectiveKey) => ObjectiveChip(
                    objectiveKey: objectiveKey,
                    selected: selected.contains(objectiveKey),
                    onToggle: () => onToggle(objectiveKey),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: ViroSpacing.xl),
          Text(
            'Combien de membres gérez-vous ?',
            textAlign: TextAlign.center,
            style: theme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: ViroColors.primary800,
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: ViroSpacing.xs,
            runSpacing: ViroSpacing.xs,
            children: ClubMemberCountRanges.all.map((range) {
              final isSelected = memberCountRange == range;
              final accent = ClubSetupUi.sportAccents[
                  ClubMemberCountRanges.all.indexOf(range) %
                      ClubSetupUi.sportAccents.length];
              return FilterChip(
                label: Text(ClubMemberCountRanges.label(range)),
                selected: isSelected,
                visualDensity: VisualDensity.compact,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                onSelected: (value) {
                  onMemberCountChanged(value ? range : null);
                },
                selectedColor: accent.withValues(alpha: 0.14),
                checkmarkColor: accent,
                side: BorderSide(
                  color: isSelected ? accent : ViroColors.primary100,
                ),
                labelStyle: theme.labelSmall?.copyWith(
                  color: isSelected ? accent : ViroColors.gray600,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                ),
              );
            }).toList(),
          ),
          const Spacer(),
        ],
      ),
    );
  }
}
