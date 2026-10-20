import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/home/widgets/planning_day_section_header.dart';
import 'package:viro_team_v2/features/planning/utils/planning_calendar_range.dart';
import 'package:viro_team_v2/models/club_event.dart';

/// Agenda d'une période regroupé par jour : en-tête de jour puis tuiles
/// fournies par [eventTileBuilder]. Les jours sans événement sont omis.
class PlanningWeekAgenda extends StatelessWidget {
  const PlanningWeekAgenda({
    super.key,
    required this.events,
    required this.eventTileBuilder,
    this.physics,
  });

  final List<ClubEvent> events;
  final Widget Function(ClubEvent event) eventTileBuilder;
  final ScrollPhysics? physics;

  @override
  Widget build(BuildContext context) {
    final entries = <_AgendaEntry>[
      for (final MapEntry(key: day, value: dayEvents)
          in groupPlanningEventsByDay(events).entries) ...[
        _AgendaDayEntry(day),
        for (final event in dayEvents) _AgendaEventEntry(event),
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
        _AgendaDayEntry(:final day) => PlanningDaySectionHeader(
          day: day,
          compactTop: index == 0,
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
  const _AgendaDayEntry(this.day);

  final DateTime day;
}

final class _AgendaEventEntry extends _AgendaEntry {
  const _AgendaEventEntry(this.event);

  final ClubEvent event;
}
