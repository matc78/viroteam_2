import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_attendance_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/attendance_team_list_tile.dart';

/// Page Présences du club : réponses des convoqués aux événements passés,
/// bilan global puis une ligne par équipe (tout le club pour le staff, ses
/// équipes pour un coach). Mêmes chiffres que la page Présences du portail.
class ClubAttendanceScreen extends ConsumerStatefulWidget {
  const ClubAttendanceScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubAttendanceScreen> createState() =>
      _ClubAttendanceScreenState();
}

class _ClubAttendanceScreenState extends ConsumerState<ClubAttendanceScreen> {
  AttendancePeriod _period = AttendancePeriod.last30Days;

  /// Seulement les équipes avec des joueurs à relancer.
  bool _toRemindOnly = false;

  @override
  Widget build(BuildContext context) {
    final fallback = AppRoutes.clubDetailPath(widget.clubId);
    final viewAsync = ref.watch(
      clubAttendanceProvider((clubId: widget.clubId, period: _period)),
    );
    final tones = ref.watch(teamCategoryTonesProvider(widget.clubId));

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.attendance.title),
      ),
      body: viewAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.attendance.loadError),
        data: (view) {
          final teams = _toRemindOnly
              ? [
                  for (final row in view.teams)
                    if (row.lowResponders.isNotEmpty) row,
                ]
              : view.teams;
          final header = _AttendanceHeader(
            summary: view.summary,
            period: _period,
            hasTeams: view.teams.isNotEmpty,
            toRemindOnly: _toRemindOnly,
            onPeriod: (period) => setState(() {
              _period = period;
              _toRemindOnly = false;
            }),
            onToggleToRemind: view.summary.lowResponderIds.isEmpty
                ? null
                : () => setState(() => _toRemindOnly = !_toRemindOnly),
          );
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.lg,
            ),
            itemCount: teams.length + 1,
            itemBuilder: (_, i) => i == 0
                ? header
                : AttendanceTeamListTile(
                    row: teams[i - 1],
                    categoryColor: tones.isEmpty
                        ? null
                        : teamCategoryToneOf(tones, teams[i - 1].team).color,
                    onTap: () => context.push(
                      AppRoutes.clubAttendanceTeamPath(
                        widget.clubId,
                        teams[i - 1].team.id,
                        period: _period.name,
                      ),
                    ),
                  ),
          );
        },
      ),
    );
  }
}

/// En-tête : explication, période, chiffres clés (À relancer filtre la liste).
class _AttendanceHeader extends StatelessWidget {
  const _AttendanceHeader({
    required this.summary,
    required this.period,
    required this.hasTeams,
    required this.toRemindOnly,
    required this.onPeriod,
    required this.onToggleToRemind,
  });

  final AttendanceSummary summary;
  final AttendancePeriod period;
  final bool hasTeams;
  final bool toRemindOnly;
  final ValueChanged<AttendancePeriod> onPeriod;
  final VoidCallback? onToggleToRemind;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.attendance;
    final toRemind = summary.lowResponderIds.length;

    Widget pair(Widget left, Widget right) => Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: left),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(child: right),
          ],
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          copy.intro,
          style: theme.bodySmall?.copyWith(color: palette.textSecondary),
        ),
        const SizedBox(height: ViroSpacing.md),
        SegmentedButton<AttendancePeriod>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment(
              value: AttendancePeriod.last30Days,
              label: Text(copy.period30Days),
            ),
            ButtonSegment(
              value: AttendancePeriod.last90Days,
              label: Text(copy.period90Days),
            ),
            ButtonSegment(
              value: AttendancePeriod.season,
              label: Text(copy.periodSeason),
            ),
          ],
          selected: {period},
          onSelectionChanged: (selected) {
            ViroHaptics.selection();
            onPeriod(selected.first);
          },
        ),
        const SizedBox(height: ViroSpacing.md),
        if (!hasTeams)
          ViroEmptyState(icon: ViroIcons.attendance, message: copy.noTeams)
        else if (summary.eventCount == 0)
          ViroEmptyState(icon: ViroIcons.attendance, message: copy.empty)
        else ...[
          pair(
            ViroStatsCard(
              label: copy.statPlayersYes,
              value: copy.rate(summary.rate),
            ),
            ViroStatsCard(
              label: copy.statTeamYes,
              value: copy.rate(summary.allRate),
              subtitle: copy.statTeamYesHint,
            ),
          ),
          pair(
            ViroStatsCard(
              label: copy.statAnswered,
              value: copy.rate(summary.allResponseRate),
            ),
            ViroStatsCard(
              label: copy.statEvents,
              value: '${summary.eventCount}',
            ),
          ),
          ViroStatsCard(
            label: copy.statToRemind,
            value: '$toRemind',
            subtitle: toRemind == 0
                ? null
                : toRemindOnly
                ? copy.showAllTeams
                : copy.toRemindFilterOn,
            onTap: onToggleToRemind,
          ),
          const SizedBox(height: ViroSpacing.md),
        ],
      ],
    );
  }
}
