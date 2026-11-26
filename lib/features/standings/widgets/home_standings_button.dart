import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/standings/providers/standings_providers.dart';

/// Coupe de l'app bar de la home : ouvre le dernier classement consulté
/// (sinon le premier suivi) ; les barres de l'écran Classement permettent
/// d'en changer. Invisible sans équipe suivie liée à une poule fédérale.
class HomeStandingsButton extends ConsumerWidget {
  const HomeStandingsButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final target = ref.watch(standingsHomeTargetProvider);
    if (target == null) return const SizedBox.shrink();
    final palette = context.viroPalette;
    return IconButton(
      tooltip: AppCopy.standings.openStandings,
      icon: ViroIcon(
        ViroIcons.trophyOutline,
        shadows: palette.neonGlow(palette.accent),
      ),
      onPressed: () => context.push(
        AppRoutes.clubTeamStandingsPath(target.clubId, target.teamId),
      ),
    );
  }
}
