import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_pick_value_row.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Carte date + heures (début/fin ou heure de match).
class AddEventScheduleCard extends StatelessWidget {
  /// Affiche la sélection de date et d’horaires de l’événement.
  const AddEventScheduleCard({
    super.key,
    required this.isMatch,
    required this.date,
    required this.start,
    required this.end,
    required this.accentColor,
    required this.enabled,
    required this.onPickDate,
    required this.onPickStart,
    required this.onPickEnd,
  });

  final bool isMatch;
  final DateTime date;
  final TimeOfDay start;
  final TimeOfDay end;
  final Color accentColor;
  final bool enabled;
  final VoidCallback onPickDate;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;

  @override
  Widget build(BuildContext context) {
    final valueStyle = Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
        );

    return ViroCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.all(ViroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AddEventPickValueRow(
            label: isMatch ? AppCopy.planning.matchDay : AppCopy.planning.date,
            value: formatEventDate(date),
            valueStyle: valueStyle,
            accentColor: accentColor,
            trailing: ViroIcon(ViroIcons.calendar, color: accentColor),
            onTap: enabled ? onPickDate : null,
          ),
          const SizedBox(height: ViroSpacing.md),
          if (isMatch)
            AddEventPickValueRow(
              label: AppCopy.planning.matchTime,
              value: addEventFormatTime(start),
              valueStyle: valueStyle,
              accentColor: accentColor,
              expand: false,
              onTap: enabled ? onPickStart : null,
            )
          else
            Row(
              children: [
                AddEventPickValueRow(
                  label: AppCopy.planning.start,
                  value: addEventFormatTime(start),
                  valueStyle: valueStyle,
                  accentColor: accentColor,
                  expand: false,
                  onTap: enabled ? onPickStart : null,
                ),
                const SizedBox(width: ViroSpacing.lg),
                AddEventPickValueRow(
                  label: AppCopy.planning.end,
                  value: addEventFormatTime(end),
                  valueStyle: valueStyle,
                  accentColor: accentColor,
                  expand: false,
                  onTap: enabled ? onPickEnd : null,
                ),
              ],
            ),
        ],
      ),
    );
  }
}
