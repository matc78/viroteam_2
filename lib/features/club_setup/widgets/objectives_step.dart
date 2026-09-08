import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/widgets/objective_tile.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';

/// Étape objectifs — priorités produit uniquement.
class ObjectivesStep extends StatelessWidget {
  const ObjectivesStep({
    super.key,
    required this.selected,
    required this.onToggle,
  });

  final Set<String> selected;
  final void Function(String key) onToggle;

  @override
  Widget build(BuildContext context) {
    return SetupStepShell(
      centerBody: true,
      subtitle:
          'Sélectionnez ce qui compte le plus — vous pourrez tout utiliser ensuite.',
      child: Wrap(
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
    );
  }
}
