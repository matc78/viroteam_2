import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_field_label.dart'
    show addEventInputDecoration;
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_pick_value_row.dart';
import 'package:viro_team_v2/models/club.dart';

/// Options avancées : RDV match, récurrence entraînement, lieu de RDV.
class AddEventMoreOptionsSection extends StatelessWidget {
  /// ExpansionTile des options secondaires du formulaire événement.
  const AddEventMoreOptionsSection({
    super.key,
    required this.isMatch,
    required this.isTraining,
    required this.practiceLocations,
    required this.meetingTime,
    required this.isRecurring,
    required this.recurrenceEndDate,
    required this.selectedMeetingLocationIndex,
    required this.accentColor,
    required this.enabled,
    required this.onPickMeetingTime,
    required this.onRecurringChanged,
    required this.onPickRecurrenceEnd,
    required this.onMeetingLocationChanged,
  });

  final bool isMatch;
  final bool isTraining;
  final List<PracticeLocation> practiceLocations;
  final TimeOfDay meetingTime;
  final bool isRecurring;
  final DateTime? recurrenceEndDate;
  final int? selectedMeetingLocationIndex;
  final Color accentColor;
  final bool enabled;
  final VoidCallback onPickMeetingTime;
  final ValueChanged<bool> onRecurringChanged;
  final VoidCallback onPickRecurrenceEnd;
  final ValueChanged<int?> onMeetingLocationChanged;

  @override
  Widget build(BuildContext context) {
    if (!isMatch && !isTraining && practiceLocations.isEmpty) {
      return const SizedBox.shrink();
    }

    final dropdownStyle = Theme.of(context).textTheme.bodyMedium;
    final valueStyle = Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
        );
    final selectedMeetingLocationValid =
        selectedMeetingLocationIndex != null &&
            selectedMeetingLocationIndex! >= 0 &&
            selectedMeetingLocationIndex! < practiceLocations.length;

    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: EdgeInsets.zero,
        initiallyExpanded: false,
        title: Text(
          AppCopy.planning.moreOptions,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: accentColor,
              ),
        ),
        subtitle: Text(
          AppCopy.planning.moreOptionsSubtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: ViroColors.gray600,
              ),
        ),
        children: [
          if (isMatch) ...[
            AddEventPickValueRow(
              label: AppCopy.planning.meetingTime,
              value: addEventFormatTime(meetingTime),
              valueStyle: valueStyle,
              accentColor: accentColor,
              onTap: enabled ? onPickMeetingTime : null,
            ),
            const SizedBox(height: ViroSpacing.md),
          ],
          if (isTraining) ...[
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                AppCopy.planning.weeklyRecurrence,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              value: isRecurring,
              onChanged: enabled ? onRecurringChanged : null,
            ),
            if (isRecurring) ...[
              const SizedBox(height: ViroSpacing.sm),
              AddEventPickValueRow(
                label: AppCopy.planning.seasonEnd,
                value: recurrenceEndDate != null
                    ? DateFormat('EEEE dd/MM/yyyy', 'fr_FR')
                        .format(recurrenceEndDate!)
                    : AppCopy.planning.chooseDate,
                valueStyle: valueStyle,
                accentColor: accentColor,
                subtitle: AppCopy.planning.seasonEndDefaultSubtitle,
                trailing: ViroIcon(ViroIcons.calendar, color: accentColor),
                onTap: enabled ? onPickRecurrenceEnd : null,
              ),
              const SizedBox(height: ViroSpacing.md),
            ],
          ],
          if (practiceLocations.isNotEmpty)
            DropdownButtonFormField<int>(
              key: ValueKey('rdv_$selectedMeetingLocationIndex'),
              initialValue: selectedMeetingLocationValid
                  ? selectedMeetingLocationIndex
                  : null,
              isDense: true,
              isExpanded: true,
              style: dropdownStyle,
              menuMaxHeight: 240,
              decoration: addEventInputDecoration(
                label: AppCopy.planning.meetingLocation,
              ),
              selectedItemBuilder: (context) => [
                for (final location in practiceLocations)
                  Text(
                    addEventPracticeLocationLabel(location),
                    style: dropdownStyle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
              items: [
                for (var i = 0; i < practiceLocations.length; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text(
                      addEventPracticeLocationLabel(practiceLocations[i]),
                      style: dropdownStyle,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: enabled ? onMeetingLocationChanged : null,
            ),
        ],
      ),
    );
  }
}
