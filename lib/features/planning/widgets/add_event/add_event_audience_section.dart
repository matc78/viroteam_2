import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_field_label.dart';
import 'package:viro_team_v2/models/club_team.dart';

/// Convoqués d'un événement sans équipe dédiée (réunion, autre) :
/// tout le club ou une sélection d'équipes. Seuls les convoqués voient
/// l'événement dans leur planning.
class AddEventAudienceSection extends StatelessWidget {
  /// Section « Convoqués » du formulaire de création.
  const AddEventAudienceSection({
    super.key,
    required this.wholeClub,
    required this.sortedTeams,
    required this.selectedTeamIds,
    required this.accentColor,
    required this.enabled,
    required this.onWholeClubChanged,
    required this.onTeamToggled,
  });

  final bool wholeClub;
  final List<ClubTeam> sortedTeams;
  final Set<String> selectedTeamIds;
  final Color accentColor;
  final bool enabled;
  final ValueChanged<bool> onWholeClubChanged;
  final ValueChanged<String> onTeamToggled;

  @override
  Widget build(BuildContext context) {
    final hintStyle = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: ViroColors.gray600);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AddEventFieldLabel(
          AppCopy.planning.fieldAudience,
          accentColor: accentColor,
        ),
        SegmentedButton<bool>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment(value: true, label: Text(AppCopy.planning.allClub)),
            ButtonSegment(
              value: false,
              label: Text(AppCopy.planning.audienceTeams),
            ),
          ],
          selected: {wholeClub},
          onSelectionChanged: enabled
              ? (selected) => onWholeClubChanged(selected.first)
              : null,
        ),
        const SizedBox(height: ViroSpacing.sm),
        if (wholeClub)
          Text(AppCopy.planning.audienceWholeClubHint, style: hintStyle)
        else if (sortedTeams.isEmpty)
          Text(AppCopy.planning.audienceNoTeams, style: hintStyle)
        else
          Wrap(
            spacing: ViroSpacing.sm,
            runSpacing: ViroSpacing.sm,
            children: [
              for (final team in sortedTeams)
                FilterChip(
                  label: Text(team.name),
                  selected: selectedTeamIds.contains(team.id),
                  onSelected: enabled ? (_) => onTeamToggled(team.id) : null,
                  selectedColor: accentColor.withValues(alpha: 0.12),
                  checkmarkColor: accentColor,
                ),
            ],
          ),
        const SizedBox(height: ViroSpacing.md),
      ],
    );
  }
}
