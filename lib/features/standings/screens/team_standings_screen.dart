import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/standings/providers/standings_providers.dart';
import 'package:viro_team_v2/features/standings/widgets/standings_header.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/team_standing_list_tile.dart';

/// Classement de la poule fédérale d'une équipe. Chaque ligne ouvre la
/// saison de l'équipe concernée. Les coachs de l'équipe (et gestionnaires
/// d'équipes) peuvent forcer une synchro FFVB depuis l'AppBar.
class TeamStandingsScreen extends ConsumerStatefulWidget {
  const TeamStandingsScreen({
    super.key,
    required this.clubId,
    required this.teamId,
  });

  final String clubId;
  final String teamId;

  @override
  ConsumerState<TeamStandingsScreen> createState() =>
      _TeamStandingsScreenState();
}

class _TeamStandingsScreenState extends ConsumerState<TeamStandingsScreen> {
  bool _busy = false;

  /// Affiche un dialog bloquant avec [ViroLogoLoader] pendant [action].
  Future<T?> _withBusyDialog<T>(Future<T> Function() action) async {
    final navigator = Navigator.of(context, rootNavigator: true);
    setState(() => _busy = true);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: false,
        child: AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ViroLogoLoader(size: 56),
              const SizedBox(height: ViroSpacing.md),
              Text(
                AppCopy.standings.refreshing,
                textAlign: TextAlign.center,
                style: Theme.of(dialogContext).textTheme.bodyMedium?.copyWith(
                  color: dialogContext.viroPalette.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    try {
      return await action();
    } finally {
      navigator.pop();
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refresh() async {
    try {
      final result = await _withBusyDialog(
        () => ref.read(teamFederationServiceProvider).refresh(
          clubId: widget.clubId,
          teamId: widget.teamId,
        ),
      );
      if (!mounted || result == null) return;
      ViroSnackBar.show(
        context,
        AppCopy.standings.refreshed(result.created + result.updated),
      );
    } catch (error) {
      if (!mounted) return;
      final tooSoon =
          error is FirebaseFunctionsException &&
          error.code == 'resource-exhausted';
      ViroSnackBar.show(
        context,
        tooSoon
            ? AppCopy.standings.refreshTooSoon
            : callableErrorMessage(
                error,
                fallback: AppCopy.standings.siteUnavailable,
              ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final teamId = widget.teamId;
    final standingsAsync = ref.watch(
      teamStandingsProvider((clubId: clubId, teamId: teamId)),
    );
    final accent = ref.watch(clubMemberAccentProvider(clubId));
    final access = ref.watch(clubAccessProvider(clubId));
    // Même périmètre que `refreshTeamFederation` / bloc FFVB « Gérer ».
    final canRefresh =
        access.coachesTeam(teamId) || access.can(ClubPermission.manageTeams);
    final fallback = AppRoutes.home;
    final copy = AppCopy.standings;

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(copy.screenTitle),
        actions: [
          if (canRefresh)
            IconButton(
              icon: ViroIcon(ViroIcons.refresh),
              tooltip: copy.refresh,
              onPressed: _busy ? null : _refresh,
            ),
        ],
      ),
      body: standingsAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: copy.loadError),
        data: (standings) {
          if (standings == null || standings.rows.isEmpty) {
            return ViroEmptyState(
              icon: ViroIcons.trophyOutline,
              message: copy.emptyTitle,
              hint: copy.emptyBody,
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
