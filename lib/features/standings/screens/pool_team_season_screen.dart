import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/standings/providers/standings_providers.dart';
import 'package:viro_team_v2/features/standings/widgets/pool_team_season_header.dart';
import 'package:viro_team_v2/features/standings/widgets/standings_section_title.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/pool_match_list_tile.dart';

/// Saison d'une équipe de la poule : rang, forme, stats, salles, parcours
/// (matchs joués) puis matchs à venir. Un tap sur un match ouvre la saison
/// de l'adversaire.
class PoolTeamSeasonScreen extends ConsumerWidget {
  const PoolTeamSeasonScreen({
    super.key,
    required this.clubId,
    required this.teamId,
    required this.poolTeamKey,
  });

  final String clubId;
  final String teamId;
  final String poolTeamKey;

  void _openOpponent(BuildContext context, PoolTeamMatch match) {
    context.push(
      AppRoutes.clubTeamStandingsSeasonPath(clubId, teamId, match.opponentKey),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seasonAsync = ref.watch(
      poolTeamSeasonProvider((
        clubId: clubId,
        teamId: teamId,
        poolTeamKey: poolTeamKey,
      )),
    );
    final accent = ref.watch(clubMemberAccentProvider(clubId));
    final fallback = AppRoutes.clubTeamStandingsPath(clubId, teamId);
    final season = seasonAsync.value;
    final title = season == null
        ? AppCopy.standings.screenTitle
        : season.isMyTeam
        ? AppCopy.standings.mySeasonTitle
        : displayPoolTeamName(season.name);

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(fallbackRoute: fallback, title: Text(title)),
      body: seasonAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.standings.loadError),
        data: (season) {
          if (season == null) {
            return ViroEmptyState(
              icon: ViroIcons.trophyOutline,
              message: AppCopy.standings.emptyTitle,
              hint: AppCopy.standings.emptyBody,
            );
          }
          const horizontal = EdgeInsets.symmetric(
            horizontal: ViroSpacing.screenHorizontal,
          );
          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.md,
                  ViroSpacing.screenHorizontal,
                  0,
                ),
                sliver: SliverToBoxAdapter(
                  child: PoolTeamSeasonHeader(season: season, accent: accent),
                ),
              ),
              SliverPadding(
                padding: horizontal,
                sliver: SliverToBoxAdapter(
                  child: StandingsSectionTitle(
                    label: AppCopy.standings.playedTitle,
                    centered: true,
                  ),
                ),
              ),
              if (season.played.isEmpty)
                SliverPadding(
                  padding: horizontal,
                  sliver: SliverToBoxAdapter(
                    child: StandingsSectionHint(
                      label: AppCopy.standings.noMatches,
                      centered: true,
                    ),
                  ),
                ),
              SliverPadding(
                padding: horizontal,
                sliver: SliverList.builder(
                  itemCount: season.played.length,
                  itemBuilder: (context, index) => PoolMatchListTile(
                    match: season.played[index],
                    onTap: () => _openOpponent(context, season.played[index]),
                  ),
                ),
              ),
              if (season.upcoming.isNotEmpty) ...[
                SliverPadding(
                  padding: horizontal,
                  sliver: SliverToBoxAdapter(
                    child: StandingsSectionTitle(
                      label: AppCopy.standings.upcomingTitle,
                      centered: true,
                    ),
                  ),
                ),
                SliverPadding(
                  padding: horizontal,
                  sliver: SliverList.builder(
                    itemCount: season.upcoming.length,
                    itemBuilder: (context, index) => PoolMatchListTile(
                      match: season.upcoming[index],
                      onTap: () =>
                          _openOpponent(context, season.upcoming[index]),
                    ),
                  ),
                ),
              ],
              const SliverToBoxAdapter(child: SizedBox(height: ViroSpacing.lg)),
            ],
          );
        },
      ),
    );
  }
}
