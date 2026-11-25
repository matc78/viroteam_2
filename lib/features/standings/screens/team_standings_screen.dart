import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/standings/providers/standings_providers.dart';
import 'package:viro_team_v2/features/standings/widgets/standings_header.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/team_standing_list_tile.dart';

/// Classement de la poule fédérale d'une équipe. Chaque ligne ouvre la
/// saison de l'équipe concernée.
class TeamStandingsScreen extends ConsumerWidget {
  const TeamStandingsScreen({
    super.key,
    required this.clubId,
    required this.teamId,
  });

  final String clubId;
  final String teamId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final standingsAsync = ref.watch(
      teamStandingsProvider((clubId: clubId, teamId: teamId)),
    );
    final accent = ref.watch(clubMemberAccentProvider(clubId));
    final fallback = AppRoutes.home;

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.standings.screenTitle),
      ),
      body: standingsAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.standings.loadError),
        data: (standings) {
          if (standings == null || standings.rows.isEmpty) {
            return ViroEmptyState(
              icon: ViroIcons.trophyOutline,
              message: AppCopy.standings.emptyTitle,
              hint: AppCopy.standings.emptyBody,
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              StandingsHeader(standings: standings, now: DateTime.now()),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(
                    ViroSpacing.screenHorizontal,
                    0,
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.lg,
                  ),
                  itemCount: standings.rows.length,
                  itemBuilder: (context, index) => TeamStandingListTile(
                    row: standings.rows[index],
                    isMyTeam: standings.rows[index].key == standings.myTeamKey,
                    accentColor: accent,
                    onTap: () => context.push(
                      AppRoutes.clubTeamStandingsSeasonPath(
                        clubId,
                        teamId,
                        standings.rows[index].key,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
