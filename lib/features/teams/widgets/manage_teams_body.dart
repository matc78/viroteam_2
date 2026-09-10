import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_manage_permissions.dart';
import 'package:viro_team_v2/features/teams/widgets/create_team_dialog.dart';
import 'package:viro_team_v2/features/teams/widgets/manage_team_card.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';

/// Ouvre le dialog de création d’équipe et persiste en Firestore.
Future<void> createClubTeam({
  required BuildContext context,
  required WidgetRef ref,
  required String clubId,
  required String sport,
}) async {
  final accent = ref.read(clubMemberAccentProvider(clubId));
  final result = await showCreateTeamDialog(
    context: context,
    sport: sport,
    accentColor: accent,
  );
  if (result == null || !context.mounted) return;

  try {
    await ref.read(teamServiceProvider).createTeam(
          clubId: clubId,
          name: result.name,
          category: result.category,
        );
    if (context.mounted) {
      ViroSnackBar.show(context, AppCopy.teams.teamCreated);
    }
  } catch (e) {
    if (context.mounted) {
      ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
    }
  }
}

/// Liste gestion des équipes du club — corps du hub Équipes.
class ManageTeamsBody extends ConsumerWidget {
  const ManageTeamsBody({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teamsAsync = ref.watch(clubTeamsProvider(clubId));
    final clubAsync = ref.watch(clubProvider(clubId));
    final memberAsync = ref.watch(clubMemberProvider(clubId));
    final authUid = ref.watch(authStateProvider).value?.uid;

    final viewerRole = memberAsync.value?.role ?? MemberRoles.player;
    final permissions = TeamManagePermissions(
      viewerRole: viewerRole,
      currentUid: authUid,
      coachPermissions:
          clubAsync.value?.coachPermissions ?? CoachPermissions.defaults,
    );

    return clubAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) => const ViroErrorState(),
      data: (club) {
        if (club == null) {
          return Center(child: Text(AppCopy.common.clubNotFound));
        }

        final accent = ref.watch(clubManagementAccentProvider(clubId));

        return teamsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => const ViroErrorState(),
          data: (teams) {
            return ViroRefreshIndicator(
              onRefresh: () async {
                await Future.wait([
                  ref.refresh(clubProvider(clubId).future),
                  ref.refresh(clubTeamsProvider(clubId).future),
                  ref.refresh(clubMemberProvider(clubId).future),
                ]);
              },
              child: teams.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(ViroSpacing.xl),
                      children: [
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.4,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                AppCopy.teams.emptyClub,
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyLarge
                                    ?.copyWith(color: ViroColors.gray600),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.md,
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.xl,
                      ),
                      itemCount: teams.length,
                      itemBuilder: (context, index) {
                        return ManageTeamCard(
                          team: teams[index],
                          club: club,
                          accent: accent,
                          permissions: permissions,
                          viewerRole: viewerRole,
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
