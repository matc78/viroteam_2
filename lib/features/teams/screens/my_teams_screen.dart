import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/widgets/team_expansion_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class MyTeamsScreen extends ConsumerWidget {
  const MyTeamsScreen({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clubAsync = ref.watch(clubProvider(clubId));
    final teamsAsync = ref.watch(myTeamsProvider(clubId));
    final memberAccent = ref.watch(clubMemberAccentProvider(clubId));

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text('Mes équipes'),
      ),
      body: clubAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const ViroErrorState(),
        data: (club) {
          if (club == null) {
            return const Center(child: Text('Club introuvable'));
          }

          final accent = ref.watch(clubMemberAccentProvider(clubId));

          return teamsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, _) => const ViroErrorState(),
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
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(ViroSpacing.xl),
                        children: [
                          SizedBox(
                            height: MediaQuery.sizeOf(context).height * 0.4,
                            child: Center(
                              child: Text(
                                'Tu n\'es affecté à aucune équipe pour le moment.',
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyLarge
                                    ?.copyWith(color: ViroColors.gray600),
                              ),
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
      ),
      ),
    );
  }
}
