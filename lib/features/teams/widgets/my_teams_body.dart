import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/widgets/manage_teams_body.dart';
import 'package:viro_team_v2/features/teams/widgets/team_expansion_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/models/club_permission.dart';

/// Liste « Mes équipes » (roster lecture) — corps du hub Équipes.
class MyTeamsBody extends ConsumerWidget {
  const MyTeamsBody({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clubAsync = ref.watch(clubProvider(clubId));
    final teamsAsync = ref.watch(myTeamsProvider(clubId));
    final canCreateTeam =
        ref.watch(clubAccessProvider(clubId)).can(ClubPermission.manageTeams);

    return clubAsync.when(
      loading: () => const Center(child: ViroLogoLoader()),
      error: (error, stackTrace) => ViroErrorState(
        onRetry: () => ref.invalidate(clubProvider(clubId)),
      ),
      data: (club) {
        if (club == null) {
          return Center(child: Text(AppCopy.common.clubNotFound));
        }

        final accent = ref.watch(clubMemberAccentProvider(clubId));

        return teamsAsync.when(
          loading: () => const Center(child: ViroLogoLoader()),
          error: (error, stackTrace) => ViroErrorState(
            onRetry: () => ref.invalidate(myTeamsProvider(clubId)),
          ),
          data: (teams) {
            return ViroRefreshIndicator(
              onRefresh: () async {
                await Future.wait([
                  ref.refresh(clubProvider(clubId).future),
                  ref.refresh(myTeamsProvider(clubId).future),
                ]);
              },
              child: teams.isEmpty
                  ? ListView(
                      physics: ViroRefreshIndicator.scrollPhysics,
                      padding: const EdgeInsets.all(ViroSpacing.md),
                      children: [
                        ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: MediaQuery.sizeOf(context).height * 0.4,
                          ),
                          child: ViroEmptyState(
                            message: canCreateTeam
                                ? AppCopy.teams.emptyMyTeamsCanCreate
                                : AppCopy.teams.emptyMyTeams,
                            icon: ViroIcons.groups,
                            actionLabel: canCreateTeam
                                ? AppCopy.teams.createTeamFab
                                : null,
                            onAction: canCreateTeam
                                ? () => createClubTeam(
                                      context: context,
                                      ref: ref,
                                      clubId: clubId,
                                      sport: club.sport,
                                    )
                                : null,
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      physics: ViroRefreshIndicator.scrollPhysics,
                      padding: const EdgeInsets.fromLTRB(
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.md,
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.xl,
                      ),
                      itemCount: teams.length,
                      itemBuilder: (context, index) {
                        return TeamExpansionCard(
                          team: teams[index],
                          club: club,
                          accent: accent,
                        );
                      },
                    ),
            );
          },
        );
      },
    );
  }
}
