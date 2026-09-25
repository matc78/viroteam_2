import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_field_label.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';

/// Dropdown type + équipe (ou titre si type « autre »).
class AddEventTypeTeamSection extends StatelessWidget {
  /// Section type d’événement et sélection d’équipe / titre libre.
  const AddEventTypeTeamSection({
    super.key,
    required this.type,
    required this.teamId,
    required this.sortedTeams,
    required this.member,
    required this.titleController,
    required this.accentColor,
    required this.enabled,
    required this.onTypeChanged,
    required this.onTeamChanged,
  });

  final String type;
  final String? teamId;
  final List<ClubTeam> sortedTeams;
  final ClubMember? member;
  final TextEditingController titleController;
  final Color accentColor;
  final bool enabled;
  final ValueChanged<String?> onTypeChanged;
  final ValueChanged<String?> onTeamChanged;

  @override
  Widget build(BuildContext context) {
    final dropdownStyle = Theme.of(context).textTheme.bodyMedium;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          initialValue: type,
          isDense: true,
          isExpanded: true,
          style: dropdownStyle,
          menuMaxHeight: 240,
          decoration: addEventInputDecoration(label: AppCopy.planning.fieldType),
          items: [
            DropdownMenuItem(
              value: EventTypes.training,
              child: Text(AppCopy.planning.typeTraining, style: dropdownStyle),
            ),
            DropdownMenuItem(
              value: EventTypes.match,
              child: Text(AppCopy.planning.typeMatch, style: dropdownStyle),
            ),
            DropdownMenuItem(
              value: EventTypes.other,
              child: Text(AppCopy.planning.typeOther, style: dropdownStyle),
            ),
          ],
          onChanged: enabled ? onTypeChanged : null,
        ),
        const SizedBox(height: ViroSpacing.md),
        if (type != EventTypes.other) ...[
          DropdownButtonFormField<String>(
            key: ValueKey(
              'team_${sortedTeams.map((t) => t.id).join('_')}_$teamId',
            ),
            initialValue:
                sortedTeams.any((t) => t.id == teamId) ? teamId : null,
            isDense: true,
            isExpanded: true,
            style: dropdownStyle,
            menuMaxHeight: 240,
            decoration:
                addEventInputDecoration(label: AppCopy.planning.fieldTeam),
            hint: Text(AppCopy.planning.chooseTeam, style: dropdownStyle),
            selectedItemBuilder: (context) => sortedTeams
                .map(
                  (team) => Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: _TeamDropdownRow(
                      team: team,
                      member: member,
                      style: dropdownStyle,
                    ),
                  ),
                )
                .toList(),
            items: sortedTeams
                .map(
                  (team) => DropdownMenuItem(
                    value: team.id,
                    child: _TeamDropdownRow(
                      team: team,
                      member: member,
                      style: dropdownStyle,
                    ),
                  ),
                )
                .toList(),
            onChanged: enabled ? onTeamChanged : null,
          ),
          const SizedBox(height: ViroSpacing.md),
        ] else ...[
          AddEventFieldLabel(
            AppCopy.planning.fieldTitle,
            accentColor: accentColor,
          ),
          TextField(
            controller: titleController,
            decoration:
                addEventInputDecoration(hint: AppCopy.planning.titleHint),
            enabled: enabled,
          ),
          const SizedBox(height: ViroSpacing.md),
        ],
      ],
    );
  }
}

/// Ligne équipe avec « C » orange si l’utilisateur est coach de l’équipe.
///
/// Pas de [Flexible]/[Expanded] : le champ fermé du dropdown impose une
/// largeur non bornée (shrink-wrap), incompatible avec un flex enfant.
class _TeamDropdownRow extends StatelessWidget {
  const _TeamDropdownRow({
    required this.team,
    required this.member,
    required this.style,
  });

  final ClubTeam team;
  final ClubMember? member;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final isCoached = member != null && team.isOnCoachRoster(member!);
    return Text.rich(
      TextSpan(
        style: style,
        children: [
          TextSpan(text: addEventTeamLabel(team)),
          if (isCoached)
            TextSpan(
              text: ' C',
              style: TextStyle(
                color: ViroColors.coachBadgeEnd,
                fontWeight: FontWeight.w800,
                fontSize: 13,
                height: style?.height,
              ),
            ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}
