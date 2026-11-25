import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/standings/providers/standings_providers.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/widgets/lists/standings_team_picker_list_tile.dart';

/// Coupe de l'app bar de la home : ouvre le classement de l'équipe suivie
/// (choix de l'équipe s'il y en a plusieurs). Invisible sans équipe liée à
/// une poule fédérale.
class HomeStandingsButton extends ConsumerWidget {
  const HomeStandingsButton({super.key});

  void _open(BuildContext context, ClubTeam team) {
    context.push(AppRoutes.clubTeamStandingsPath(team.clubId, team.id));
  }

  Future<void> _pick(BuildContext context, List<ClubTeam> teams) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: context.viroPalette.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(ViroSpacing.cardRadius),
        ),
      ),
      builder: (sheetContext) => SafeArea(
        child: Consumer(
          builder: (context, ref, _) => ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.lg,
              ViroSpacing.md,
              ViroSpacing.lg,
              ViroSpacing.lg,
            ),
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: ViroSpacing.md),
                child: Text(
                  AppCopy.standings.pickTeamTitle,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: context.viroPalette.brandText,
                  ),
                ),
              ),
              for (final team in teams)
                StandingsTeamPickerListTile(
                  team: team,
                  accentColor: ref.watch(clubMemberAccentProvider(team.clubId)),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _open(context, team);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teams = ref.watch(homeStandingsTeamsProvider);
    if (teams.isEmpty) return const SizedBox.shrink();
    final palette = context.viroPalette;
    return IconButton(
      tooltip: AppCopy.standings.openStandings,
      icon: ViroIcon(
        ViroIcons.trophyOutline,
        shadows: palette.neonGlow(palette.accent),
      ),
      onPressed: () =>
          teams.length == 1 ? _open(context, teams.single) : _pick(context, teams),
    );
  }
}
