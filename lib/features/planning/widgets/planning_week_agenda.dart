import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/home/widgets/planning_day_section_header.dart';
import 'package:viro_team_v2/features/planning/utils/planning_calendar_range.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';

/// Agenda d'une semaine : un en-tête pour chaque jour (lundi → dimanche),
/// puis les tuiles fournies par [eventTileBuilder]. Les jours sans événement
/// sont affichés grisés et compactés (sans libellé « vide »).
class PlanningWeekAgenda extends StatelessWidget {
  const PlanningWeekAgenda({
    super.key,
    required this.weekStart,
    required this.events,
    required this.eventTileBuilder,
    this.physics,
    this.accentColor,
  });

  /// Lundi (minuit local) de la semaine affichée.
  final DateTime weekStart;
  final List<ClubEvent> events;
  final Widget Function(ClubEvent event) eventTileBuilder;
  final ScrollPhysics? physics;

  /// Couleur club pour le badge « Aujourd'hui » / « Demain ».
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final eventsByDay = groupPlanningEventsByDay(events);
    final weekDays = List.generate(
      7,
      (index) => addCalendarDays(planningDateOnly(weekStart), index),
    );

    final entries = <_AgendaEntry>[
      for (final day in weekDays) ...[
        _AgendaDayEntry(day, muted: !eventsByDay.containsKey(day)),
        if (eventsByDay.containsKey(day))
          for (final event in eventsByDay[day]!) _AgendaEventEntry(event),
      ],
    ];

    return ListView.builder(
      physics: physics,
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.xs,
        ViroSpacing.screenHorizontal,
        ViroSpacing.xl,
      ),
      itemCount: entries.length,
      itemBuilder: (_, index) => switch (entries[index]) {
        _AgendaDayEntry(:final day, :final muted) => PlanningDaySectionHeader(
          day: day,
          compactTop: index == 0 || muted,
          muted: muted,
          accentColor: accentColor,
        ),
        _AgendaEventEntry(:final event) => Padding(
          padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
          child: eventTileBuilder(event),
        ),
      },
    );
  }
}

/// Ligne de l'agenda : en-tête de jour ou événement.
sealed class _AgendaEntry {
  const _AgendaEntry();
}

final class _AgendaDayEntry extends _AgendaEntry {
  const _AgendaDayEntry(this.day, {required this.muted});

  final DateTime day;
  final bool muted;
}

final class _AgendaEventEntry extends _AgendaEntry {
  const _AgendaEventEntry(this.event);

  final ClubEvent event;
}
