import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/widgets/lists/team_category_header_list_tile.dart';
import 'package:viro_team_v2/features/teams/widgets/create_team_dialog.dart';
import 'package:viro_team_v2/features/teams/widgets/manage_team_card.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/models/club_permission.dart';

/// Ouvre le dialog de création d’équipe et persiste en Firestore.
///
/// Retourne `true` si l’équipe a bien été créée (pour basculer l’onglet
/// Gestion depuis « Mes équipes », où la nouvelle équipe n’apparaît pas).
Future<bool> createClubTeam({
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
  if (result == null || !context.mounted) return false;

  try {
    await ref.read(teamServiceProvider).createTeam(
          clubId: clubId,
          name: result.name,
          category: result.category,
        );
    if (context.mounted) {
      ViroSnackBar.show(context, AppCopy.teams.teamCreated);
    }
    return true;
  } catch (e) {
    if (context.mounted) {
      ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
    }
    return false;
  }
}

/// Liste gestion des équipes du club — corps du hub Équipes, groupée par
/// catégorie (repliable, une couleur par catégorie comme sur le portail).
class ManageTeamsBody extends ConsumerStatefulWidget {
  const ManageTeamsBody({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ManageTeamsBody> createState() => _ManageTeamsBodyState();
}

class _ManageTeamsBodyState extends ConsumerState<ManageTeamsBody> {
  /// Catégories repliées par l’utilisateur (propres au club affiché).
  final _collapsed = <String>{};

  @override
  void didUpdateWidget(covariant ManageTeamsBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.clubId != widget.clubId) _collapsed.clear();
  }

  void _toggle(String category) => setState(() {
        if (!_collapsed.remove(category)) _collapsed.add(category);
      });

  /// Lignes à afficher : en-tête de chaque catégorie puis ses équipes
  /// (sauf repliée).
  List<_ManageTeamsRow> _rows(List<TeamCategoryGroup> groups) => [
        for (final group in groups) ...[
          _ManageTeamsRow.header(group),
          if (!_collapsed.contains(group.category))
            for (final team in group.teams) _ManageTeamsRow.team(team, group),
        ],
      ];

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final teamsAsync = ref.watch(clubTeamsProvider(clubId));
    final clubAsync = ref.watch(clubProvider(clubId));
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

        final accent = ref.watch(clubManagementAccentProvider(clubId));

        return teamsAsync.when(
          loading: () => const Center(child: ViroLogoLoader()),
          error: (error, stackTrace) => ViroErrorState(
            onRetry: () => ref.invalidate(clubTeamsProvider(clubId)),
          ),
          data: (teams) {
            final rows = _rows(
              ref.watch(manageTeamCategoryGroupsProvider(clubId)) ?? const [],
            );
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
                      physics: ViroRefreshIndicator.scrollPhysics,
                      padding: const EdgeInsets.all(ViroSpacing.md),
                      children: [
                        ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: MediaQuery.sizeOf(context).height * 0.4,
                          ),
                          child: ViroEmptyState(
                            message: canCreateTeam
                                ? AppCopy.teams.emptyClub
                                : AppCopy.teams.emptyClubReadOnly,
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
                      itemCount: rows.length,
                      itemBuilder: (context, index) {
                        final row = rows[index];
                        final team = row.team;
                        if (team == null) {
                          return TeamCategoryHeaderListTile(
                            key: ValueKey('category:${row.group.category}'),
                            group: row.group,
                            expanded:
                                !_collapsed.contains(row.group.category),
                            onToggle: () => _toggle(row.group.category),
                          );
                        }
                        // Clé d'équipe : l'ordre change (tri « mes équipes
                        // d'abord »), l'état dépliée ne doit pas suivre l'index.
                        return ManageTeamCard(
                          key: ValueKey(team.id),
                          team: team,
                          club: club,
                          accent: accent,
                          categoryColor: row.group.tone.color,
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

/// Ligne de la liste Gestion : en-tête de catégorie ([team] nul) ou équipe.
class _ManageTeamsRow {
  const _ManageTeamsRow.header(this.group) : team = null;
  const _ManageTeamsRow.team(ClubTeam this.team, this.group);

  final TeamCategoryGroup group;
  final ClubTeam? team;
}
