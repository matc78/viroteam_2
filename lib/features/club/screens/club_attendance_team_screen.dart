import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_attendance_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/attendance_event_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/attendance_member_list_tile.dart';

/// Nombre d'événements affichés dans le détail d'une équipe (comme le
/// portail).
const int _recentEventsShown = 12;

/// Détail des présences d'une équipe sur [period] : joueurs du moins au plus
/// présent (« Répond peu »), coachs, derniers événements.
class ClubAttendanceTeamScreen extends ConsumerWidget {
  const ClubAttendanceTeamScreen({
    super.key,
    required this.clubId,
    required this.teamId,
    required this.period,
  });

  final String clubId;
  final String teamId;
  final AttendancePeriod period;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fallback = AppRoutes.clubAttendancePath(clubId);
    final rowAsync = ref.watch(
      clubAttendanceTeamProvider((
        clubId: clubId,
        period: period,
        teamId: teamId,
      )),
    );
    final row = rowAsync.value;

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(row?.team.name ?? AppCopy.attendance.title),
      ),
      body: rowAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.attendance.loadError),
        data: (row) {
          if (row == null) {
            return ViroErrorState(message: AppCopy.attendance.teamNotFound);
          }
          final items = _items(row);
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.lg,
            ),
            itemCount: items.length,
            itemBuilder: (_, i) => switch (items[i]) {
              _SectionItem(:final title) => _SectionTitle(title),
              _MemberItem(:final member, :final isPlayer) =>
                AttendanceMemberListTile(
                  member: member,
                  showLowResponder: isPlayer,
                ),
              _EventItem(:final row) => AttendanceEventListTile(
                row: row,
                title: PlanningEventDisplay.calendarTitle(row.event),
              ),
            },
          );
        },
      ),
    );
  }

  /// Lignes de la liste : sections joueurs, coachs, derniers événements.
  static List<_Item> _items(TeamAttendance row) => [
    _SectionItem(AppCopy.attendance.playersSection),
    for (final player in row.players) _MemberItem(player, isPlayer: true),
    if (row.coaches.isNotEmpty) ...[
      _SectionItem(AppCopy.attendance.coachesSection),
      for (final coach in row.coaches) _MemberItem(coach, isPlayer: false),
    ],
    if (row.events.isNotEmpty) ...[
      _SectionItem(AppCopy.attendance.eventsSection),
      for (final event in row.events.take(_recentEventsShown))
        _EventItem(event),
    ],
  ];
}

sealed class _Item {
  const _Item();
}

final class _SectionItem extends _Item {
  const _SectionItem(this.title);
  final String title;
}

final class _MemberItem extends _Item {
  const _MemberItem(this.member, {required this.isPlayer});
  final MemberAttendance member;
  final bool isPlayer;
}

final class _EventItem extends _Item {
  const _EventItem(this.row);
  final EventAttendance row;
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: ViroSpacing.sm, bottom: ViroSpacing.sm),
    child: Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
        color: context.viroPalette.brandText,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}
