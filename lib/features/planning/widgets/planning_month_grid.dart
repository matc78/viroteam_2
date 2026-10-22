import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/planning_calendar_range.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_day_picker.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';

/// Grille mensuelle du planning : une case par jour, pastilles par type
/// d'événement, tap pour sélectionner le jour.
class PlanningMonthGrid extends StatelessWidget {
  const PlanningMonthGrid({
    super.key,
    required this.month,
    required this.selectedDay,
    required this.eventsByDay,
    required this.onDaySelected,
    this.accentColor,
  });

  /// N'importe quel jour du mois affiché.
  final DateTime month;
  final DateTime selectedDay;

  /// Événements indexés par jour (minuit local), cf. [groupPlanningEventsByDay].
  final Map<DateTime, List<ClubEvent>> eventsByDay;
  final ValueChanged<DateTime> onDaySelected;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final days = planningMonthGridDays(month);
    final weeks = [
      for (var i = 0; i < days.length; i += 7) days.sublist(i, i + 7),
    ];
    final weekdayFormat = DateFormat('EEEEE', 'fr_FR');
    final labelStyle = Theme.of(context).textTheme.labelSmall?.copyWith(
      color: context.viroPalette.textSecondary,
      fontWeight: FontWeight.w700,
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(
            child: Row(
              children: [
                for (final day in weeks.first)
                  Expanded(
                    child: Text(
                      weekdayFormat.format(day).toUpperCase(),
                      textAlign: TextAlign.center,
                      style: labelStyle,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          for (final week in weeks)
            Row(
              children: [
                for (final day in week)
                  Expanded(
                    child: _MonthDayCell(
                      day: day,
                      inMonth: day.month == month.month,
                      isSelected: DateUtils.isSameDay(day, selectedDay),
                      events: eventsByDay[day] ?? const [],
                      accentColor: accentColor ?? context.viroPalette.accentFill,
                      onTap: () => onDaySelected(day),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _MonthDayCell extends StatelessWidget {
  const _MonthDayCell({
    required this.day,
    required this.inMonth,
    required this.isSelected,
    required this.events,
    required this.accentColor,
    required this.onTap,
  });

  final DateTime day;
  final bool inMonth;
  final bool isSelected;
  final List<ClubEvent> events;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final today = planningDateOnly(DateTime.now());
    final isToday = day == today;
    final isPast = day.isBefore(today);
    final eventTypes = events.map((e) => e.type).toSet().take(3).toList();

    final palette = context.viroPalette;
    final Color numberColor;
    if (isSelected) {
      numberColor = ViroColors.white;
    } else if (!inMonth) {
      numberColor = palette.borderStrong;
    } else if (isPast) {
      numberColor = palette.textMuted;
    } else {
      numberColor = palette.brandText;
    }

    return Semantics(
      button: true,
      selected: isSelected,
      label: AppCopy.planning.monthDayCellLabel(
        formatDayLong(day),
        events.length,
      ),
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        child: SizedBox(
          height: 52,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isSelected ? accentColor : null,
                  shape: BoxShape.circle,
                  border: isToday && !isSelected
                      ? Border.all(color: accentColor, width: 2)
                      : null,
                ),
                child: Text(
                  '${day.day}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: numberColor,
                    fontWeight: isToday || isSelected
                        ? FontWeight.w800
                        : FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 3),
              SizedBox(
                height: 5,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final type in eventTypes)
                      Container(
                        width: 5,
                        height: 5,
                        margin: const EdgeInsets.symmetric(horizontal: 1),
                        decoration: BoxDecoration(
                          color: inMonth
                              ? eventDotColor(type, palette)
                              : eventDotColor(type, palette)
                                  .withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Légende des pastilles de type d'événement de la grille mensuelle.
class PlanningEventTypeLegend extends StatelessWidget {
  const PlanningEventTypeLegend({super.key});

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(
      context,
    ).textTheme.labelSmall?.copyWith(color: context.viroPalette.textSecondary);
    final entries = [
      (EventTypes.match, AppCopy.planning.typeMatch),
      (EventTypes.training, AppCopy.planning.typeTraining),
      (EventTypes.tournament, AppCopy.planning.typeTournament),
      (EventTypes.meeting, AppCopy.planning.typeMeeting),
      (EventTypes.other, AppCopy.planning.typeOther),
    ];

    return Wrap(
      alignment: WrapAlignment.center,
      spacing: ViroSpacing.md,
      runSpacing: ViroSpacing.xs,
      children: [
        for (final (type, label) in entries)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: eventDotColor(type, context.viroPalette),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: ViroSpacing.xs),
              Text(label, style: style),
            ],
          ),
      ],
    );
  }
}
