import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/planning/providers/planning_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';

/// Couleur du dot indicateur selon le type d'événement ([palette] : teinte
/// neutre des types non catégorisés).
Color eventDotColor(String type, ViroPalette palette) => switch (type) {
      EventTypes.match => ViroColors.error,
      EventTypes.training => ViroColors.success,
      EventTypes.tournament => ViroColors.warning,
      EventTypes.meeting => ViroColors.sportCyan,
      _ => palette.textMuted,
    };

/// Bandeau horizontal de sélection de jour (style V1, design V2).
class PlanningDayPicker extends StatelessWidget {
  const PlanningDayPicker({
    super.key,
    required this.days,
    required this.selectedDay,
    required this.onDaySelected,
    required this.clubId,
    required this.useManagerView,
    this.scrollController,
    this.todayBorderColor,
    this.selectedDayColor,
  });

  final List<DateTime> days;
  final DateTime selectedDay;
  final ValueChanged<DateTime> onDaySelected;
  final ScrollController? scrollController;
  final String clubId;
  final bool useManagerView;
  final Color? todayBorderColor;
  final Color? selectedDayColor;

  static const double _itemWidth = 77;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox.shrink();

    final viewportWidth = MediaQuery.sizeOf(context).width;
    final sidePadding = (viewportWidth - _itemWidth) / 2;

    return SizedBox(
      height: 100,
      child: ListView.builder(
        controller: scrollController,
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(horizontal: sidePadding),
        itemCount: days.length,
        itemBuilder: (context, index) {
          final date = days[index];
          return _DayTile(
            date: date,
            isSelected: DateUtils.isSameDay(date, selectedDay),
            onTap: () => onDaySelected(date),
            clubId: clubId,
            useManagerView: useManagerView,
            todayBorderColor: todayBorderColor,
            selectedDayColor: selectedDayColor,
          );
        },
      ),
    );
  }

}

class _DayTile extends ConsumerWidget {
  const _DayTile({
    required this.date,
    required this.isSelected,
    required this.onTap,
    required this.clubId,
    required this.useManagerView,
    this.todayBorderColor,
    this.selectedDayColor,
  });

  final DateTime date;
  final bool isSelected;
  final VoidCallback onTap;
  final String clubId;
  final bool useManagerView;
  final Color? todayBorderColor;
  final Color? selectedDayColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = DateTime.now();
    final todayDay = DateTime(today.year, today.month, today.day);
    final isPast = date.isBefore(todayDay);
    final isToday = DateUtils.isSameDay(date, today);

    final dayParams = (clubId: clubId, day: date);
    final eventsAsync = useManagerView
        ? ref.watch(clubPlanningEventsProvider(dayParams))
        : ref.watch(memberClubPlanningEventsProvider(dayParams));

    final eventTypes = eventsAsync.whenOrNull(
              data: (events) =>
                  events.map((e) => e.type).toSet().toList(),
            ) ??
        [];

    final palette = context.viroPalette;
    final (bg, border, fg, subFg) = _tileColors(
      palette: palette,
      isSelected: isSelected,
      isPast: isPast,
      selectedDayColor: selectedDayColor,
    );

    final effectiveBorder =
        isToday && !isSelected && todayBorderColor != null
            ? todayBorderColor!
            : border;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 65,
        margin: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(
            color: effectiveBorder,
            width: isToday && !isSelected && todayBorderColor != null ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              DateFormat('E', 'fr_FR').format(date).toUpperCase(),
              style: TextStyle(
                color: subFg,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              '${date.day}',
              style: TextStyle(
                color: fg,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              DateFormat('MMM', 'fr_FR').format(date).toUpperCase(),
              style: TextStyle(color: subFg, fontSize: 10),
            ),
            if (eventTypes.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: eventTypes.take(3).map((type) {
                    return Container(
                      width: 5,
                      height: 5,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? ViroColors.white
                            : eventDotColor(type, palette),
                        shape: BoxShape.circle,
                      ),
                    );
                  }).toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

(Color bg, Color border, Color fg, Color subFg) _tileColors({
  required ViroPalette palette,
  required bool isSelected,
  required bool isPast,
  Color? selectedDayColor,
}) {
  if (isSelected) {
    final accent = selectedDayColor ?? palette.accentFill;
    final bg = isPast ? palette.textMuted : accent;
    return (bg, bg, ViroColors.white, ViroColors.white.withValues(alpha: 0.75));
  }
  if (isPast) {
    return (
      palette.surfaceMuted,
      palette.borderStrong,
      palette.textMuted,
      palette.textMuted,
    );
  }
  return (
    palette.surfaceCard,
    (selectedDayColor ?? palette.accentSoft).withValues(alpha: 0.5),
    selectedDayColor != null
        ? palette.readableAccent(selectedDayColor)
        : palette.brandText,
    palette.textSecondary,
  );
}

/// Horizon par défaut du bandeau de jours (jours après aujourd'hui).
const int planningPickerFutureDays = 28;

List<DateTime> buildPlanningDays({
  DateTime? firstEventDate,
  int futureDays = planningPickerFutureDays,
}) {
  final today = DateTime.now();
  final todayDay = DateTime(today.year, today.month, today.day);
  final start = firstEventDate != null && firstEventDate.isBefore(todayDay)
      ? DateTime(
          firstEventDate.year,
          firstEventDate.month,
          firstEventDate.day,
        )
      : todayDay;
  final end = addCalendarDays(todayDay, futureDays);

  final days = <DateTime>[];
  var d = start;
  while (!d.isAfter(end)) {
    days.add(d);
    d = addCalendarDays(d, 1);
  }
  return days;
}

void scrollPlanningToDay({
  required ScrollController controller,
  required List<DateTime> days,
  required DateTime day,
}) {
  if (!controller.hasClients) return;
  final index = days.indexWhere((d) => DateUtils.isSameDay(d, day));
  if (index < 0) return;
  const itemWidth = 77.0;
  final target = index * itemWidth;
  final max = controller.position.maxScrollExtent;
  controller.animateTo(
    target.clamp(0.0, max),
    duration: const Duration(milliseconds: 280),
    curve: Curves.easeOutCubic,
  );
}
