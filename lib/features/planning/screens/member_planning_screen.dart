import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/home/providers/home_teams_provider.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/planning/widgets/member_upcoming_events_list.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_detail_sheet.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/section_shimmer.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Planning global membre — tous les clubs, fenêtre 14 jours.
class MemberPlanningScreen extends ConsumerWidget {
  const MemberPlanningScreen({super.key});

  Map<String, String> _clubNames(List<UserClubEntry> clubs) => {
        for (final entry in clubs) entry.club.id: entry.club.name,
      };

  Map<String, Color> _clubColors(List<UserClubEntry> clubs) => {
        for (final entry in clubs)
          entry.club.id: clubAccentColor(
            brandColorHex: entry.club.brandColorHex,
            clubId: entry.club.id,
          ),
      };

  Future<void> _setRsvp(
    WidgetRef ref,
    BuildContext context,
    ClubEvent event,
    RsvpStatus status,
  ) async {
    final authUid = ref.read(authStateProvider).value?.uid;
    if (authUid == null) return;

    final eventService = ref.read(eventServiceProvider);
    final audienceId = await eventService.resolveAudienceId(
      clubId: event.clubId,
      authUid: authUid,
    );

    try {
      await eventService.updateRsvp(
        clubId: event.clubId,
        eventId: event.id,
        uid: audienceId,
        status: status,
      );
      ref.invalidate(memberEventsProvider);
    } catch (_) {
      ref.invalidate(memberEventsProvider);
      if (context.mounted) {
        ViroSnackBar.show(context, 'RSVP impossible, réessayez');
      }
    }
  }

  void _showEventDetail({
    required BuildContext context,
    required WidgetRef ref,
    required ClubEvent event,
    required Map<String, ClubTeam> teams,
    required bool canManageEvents,
  }) {
    PlanningEventDetailSheet.show(
      context: context,
      ref: ref,
      clubId: event.clubId,
      event: event,
      teamLabel: PlanningEventDisplay.teamLabel(event, teams),
      excludeCoachUids: PlanningEventDisplay.coachUidsToExclude(
        event,
        teams,
        membersByUid: ref.read(clubMembersProvider(event.clubId)).value != null
            ? indexClubMembersByUid(
                ref.read(clubMembersProvider(event.clubId)).value!,
              )
            : null,
      ),
      canManageEvents: canManageEvents,
      onCanceled: () {},
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clubsAsync = ref.watch(userClubsProvider);
    final eventsAsync = ref.watch(memberEventsProvider);
    final teamsByClub = ref.watch(homeClubTeamsProvider).value ??
        const <String, Map<String, ClubTeam>>{};

    return ViroScaffold(
      appBar: ViroAppBar(
        title: const Text('Planning'),
      ),
      body: clubsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => ViroErrorState(
          message: 'Impossible de charger vos clubs',
          onRetry: () => ref.invalidate(userClubsProvider),
        ),
        data: (clubs) {
          final names = _clubNames(clubs);
          final colors = _clubColors(clubs);

          return eventsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(ViroSpacing.screenHorizontal),
              child: SectionShimmer(itemCount: 5),
            ),
            error: (_, __) => ViroErrorState(
              message: 'Impossible de charger le planning',
              onRetry: () => ref.invalidate(memberEventsProvider),
            ),
            data: (state) {
              if (state.upcoming.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(ViroSpacing.lg),
                    child: Text(
                      'Aucun événement prévu dans les 14 prochains jours.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: ViroColors.gray600,
                          ),
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(memberEventsProvider);
                  ref.invalidate(userClubsProvider);
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.md,
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.xl,
                  ),
                  children: [
                    Row(
                      children: [
                        ViroIcon(
                          ViroIcons.calendar,
                          size: 20,
                          color: ViroColors.primary800,
                        ),
                        const SizedBox(width: ViroSpacing.sm),
                        Text(
                          '14 prochains jours',
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: ViroColors.primary800,
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                      ],
                    ),
                    const SizedBox(height: ViroSpacing.md),
                    MemberUpcomingEventsList(
                      events: state.upcoming,
                      clubNames: names,
                      clubColors: colors,
                      teamsByClub: teamsByClub,
                      onShowDetail: ({
                        required event,
                        required teams,
                        required canManageEvents,
                      }) =>
                          _showEventDetail(
                        context: context,
                        ref: ref,
                        event: event,
                        teams: teams,
                        canManageEvents: canManageEvents,
                      ),
                      onSetRsvp: (event, status) =>
                          _setRsvp(ref, context, event, status),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
