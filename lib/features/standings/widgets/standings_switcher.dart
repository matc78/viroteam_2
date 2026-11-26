import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/config/viro_standings.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/standings/providers/standings_providers.dart';
import 'package:viro_team_v2/features/standings/widgets/standings_switcher_bars.dart';
import 'package:viro_team_v2/services/standings/standings_switcher.dart';

/// Choix du classement sous l'AppBar : onglets de club (si plusieurs, avec
/// les prénoms des enfants suivis) puis sélecteur segmenté des équipes du
/// club (si plusieurs, avec le badge de rang). Rien si l'équipe affichée
/// n'est pas suivie ou s'il n'y a qu'un classement.
class StandingsSwitcher extends ConsumerWidget {
  const StandingsSwitcher({
    super.key,
    required this.clubId,
    required this.teamId,
  });

  final String clubId;
  final String teamId;

  void _open(BuildContext context, StandingsEntry entry) {
    context.replace(
      AppRoutes.clubTeamStandingsPath(entry.clubId, entry.primary.id),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(standingsGroupsProvider);
    final current = ref.watch(
      standingsEntryProvider((clubId: clubId, teamId: teamId)),
    );
    if (current == null) return const SizedBox.shrink();
    final currentGroup = groups.firstWhere((group) => group.clubId == clubId);
    final showClubs = groups.length > 1;
    final showTeams = currentGroup.entries.length > 1;
    if (!showClubs && !showTeams) return const SizedBox.shrink();

    final copy = AppCopy.standings;
    final lastByClub = ref.watch(standingsLastViewedProvider).teamByClub;
    final clubColor = ref.watch(clubMemberAccentProvider(clubId));

    String? children(List<String> names) =>
        names.isEmpty ? null : names.join(', ');

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showClubs)
            StandingsClubTabs(
              options: [
                for (final group in groups)
                  StandingsSwitcherOption(
                    label: group.clubName,
                    detail: children(group.childNames),
                    color: ref.watch(clubMemberAccentProvider(group.clubId)),
                    selected: group.clubId == clubId,
                    semanticLabel: copy.clubChipSemantics(
                      group.clubName,
                      group.childNames,
                    ),
                    onTap: () => _open(
                      context,
                      entryForClub(group, lastByClub[group.clubId]),
                    ),
                  ),
              ],
            ),
          if (showClubs && showTeams)
            const SizedBox(height: ViroStandings.switcherGap),
          if (showTeams)
            StandingsTeamSegments(
              options: [
                for (final entry in currentGroup.entries)
                  _teamOption(context, ref, entry, clubColor, children),
              ],
            ),
        ],
      ),
    );
  }

  StandingsSwitcherOption _teamOption(
    BuildContext context,
    WidgetRef ref,
    StandingsEntry entry,
    Color clubColor,
    String? Function(List<String>) children,
  ) {
    final rank = ref.watch(
      standingsEntryRankProvider((
        clubId: entry.clubId,
        teamId: entry.primary.id,
      )),
    );
    return StandingsSwitcherOption(
      label: entry.label,
      detail: children(entry.childNames),
      color: clubColor,
      selected: entry.containsTeam(teamId),
      rank: rank,
      semanticLabel: AppCopy.standings.teamChipSemantics(
        entry.label,
        entry.childNames,
        rank,
      ),
      onTap: () => _open(context, entry),
    );
  }
}
