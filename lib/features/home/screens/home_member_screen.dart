import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/home/providers/home_teams_provider.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/features/clubs/widgets/add_club_sheet.dart';
import 'package:viro_team_v2/features/home/widgets/club_selector_bar.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/planning/widgets/member_upcoming_events_list.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_detail_sheet.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/features/announcements/widgets/home_announcement_banner.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_reminder_banner.dart';
import 'package:viro_team_v2/features/home/widgets/home_quiet_content.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/section_shimmer.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class HomeMemberScreen extends ConsumerStatefulWidget {
  const HomeMemberScreen({super.key});

  @override
  ConsumerState<HomeMemberScreen> createState() => _HomeMemberScreenState();
}

class _HomeMemberScreenState extends ConsumerState<HomeMemberScreen> {
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToTop() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  Map<String, String> _clubNames(List<UserClubEntry> clubs) => {
        for (final e in clubs) e.club.id: e.club.name,
      };

  Map<String, Color> _clubColors(List<UserClubEntry> clubs) => {
        for (final e in clubs)
          e.club.id: clubAccentColor(
            brandColorHex: e.club.brandColorHex,
            clubId: e.club.id,
          ),
      };

  Map<String, Color?> _clubSecondaryColors(List<UserClubEntry> clubs) => {
        for (final e in clubs)
          e.club.id: resolveClubBrandColors(
            brandColorHex: e.club.brandColorHex,
            clubId: e.club.id,
          ).secondary,
      };

  void _showEventDetail({
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

  Future<void> _setRsvp(ClubEvent event, RsvpStatus status) async {
    final authUid = ref.read(authStateProvider).value?.uid;
    if (authUid == null) return;

    final eventService = ref.read(eventServiceProvider);
    final audienceId = await eventService.resolveAudienceId(
      clubId: event.clubId,
      authUid: authUid,
    );

    // Optimistic : invalide après succès ; snackbar + rechargement si échec.
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
      if (mounted) {
        ViroSnackBar.show(context, 'RSVP impossible, réessayez');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubsAsync = ref.watch(userClubsProvider);
    final eventsAsync = ref.watch(memberEventsProvider);
    final teamsByClub = ref.watch(homeClubTeamsProvider).value ??
        const <String, Map<String, ClubTeam>>{};
    final pendingCounts = ref.watch(pendingCountByClubProvider);
    final userAsync = ref.watch(viroUserProvider);

    return ViroScaffold(
      appBar: ViroAppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ViroLogoMark(height: 28),
            SizedBox(width: ViroSpacing.sm),
            Text(ProjectConfig.appName),
          ],
        ),
        onTitleTap: _scrollToTop,
        actions: [
          IconButton(
            icon: ViroIcon(ViroIcons.settings),
            onPressed: () => context.push(AppRoutes.userSettings),
          ),
        ],
      ),
      body: clubsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ViroErrorState(
          message: 'Impossible de charger vos clubs',
          onRetry: () => ref.invalidate(userClubsProvider),
        ),
        data: (clubs) {
          if (clubs.isEmpty) {
            return _EmptyClubsBody(
              onJoin: () => showAddClubSheet(context, ref),
            );
          }

          final names = _clubNames(clubs);
          final colors = _clubColors(clubs);
          final secondaryColors = _clubSecondaryColors(clubs);

          return Stack(
            children: [
              eventsAsync.when(
                  loading: () => const _HomeLoadingBody(),
                  error: (e, _) => ViroErrorState(
                    message: 'Impossible de charger le planning',
                    onRetry: () => ref.invalidate(memberEventsProvider),
                  ),
                  data: (state) {
                    final isFullyQuiet = state.upcoming.isEmpty;
                    final firstName = userAsync.value?.firstName;

                    return RefreshIndicator(
                      onRefresh: () async {
                        await Future.wait([
                          ref.refresh(memberEventsProvider.future),
                          ref.refresh(userClubsProvider.future),
                          ref.refresh(userClubsWithEventsProvider.future),
                          ref.refresh(viroUserFutureProvider.future),
                          ref.refresh(homeClubTeamsProvider.future),
                        ]);
                      },
                      child: CustomScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        controller: _scrollController,
                        slivers: [
                          const SliverToBoxAdapter(
                            child: SizedBox(height: ViroSpacing.md),
                          ),
                          const SliverToBoxAdapter(
                            child: HomeAnnouncementBanner(),
                          ),
                          const SliverToBoxAdapter(
                            child: FeeReminderBanner(),
                          ),
                          if (!isFullyQuiet) ...[
                            SliverToBoxAdapter(
                              child: _SectionTitle(
                                icon: ViroIcons.calendar,
                                title: 'Planning à venir',
                              ),
                            ),
                            MemberUpcomingEventsSliver(
                              events: state.upcoming,
                              clubNames: names,
                              clubColors: colors,
                              clubSecondaryColors: secondaryColors,
                              teamsByClub: teamsByClub,
                              maxEvents: memberHomePlanningPreviewLimit,
                              onShowDetail: _showEventDetail,
                              onSetRsvp: _setRsvp,
                            ),
                            if (state.upcoming.length >
                                memberHomePlanningPreviewLimit)
                              SliverToBoxAdapter(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    ViroSpacing.screenHorizontal,
                                    0,
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.lg,
                                  ),
                                  child: ViroPrimaryButton(
                                    label: 'Voir tout le planning',
                                    onPressed: () =>
                                        context.push(AppRoutes.memberPlanning),
                                  ),
                                ),
                              ),
                          ],
                          if (isFullyQuiet)
                            SliverToBoxAdapter(
                              child: HomeQuietContent(
                                clubs: clubs,
                                firstName: firstName,
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              Positioned(
                left: 0,
                right: 0,
                bottom: ViroSpacing.md,
                child: ClubSelectorBar(
                  clubs: clubs,
                  pendingByClub: pendingCounts,
                  onAddClub: () => showAddClubSheet(context, ref),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.md,
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
      ),
      child: Row(
        children: [
          ViroIcon(icon, size: 20, color: ViroColors.primary800),
          const SizedBox(width: ViroSpacing.sm),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ViroColors.primary800,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _HomeLoadingBody extends StatelessWidget {
  const _HomeLoadingBody();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(ViroSpacing.screenHorizontal),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionShimmer(itemCount: 3),
        ],
      ),
    );
  }
}

class _EmptyClubsBody extends StatelessWidget {
  const _EmptyClubsBody({required this.onJoin});

  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(ViroSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'Rejoignez un club pour voir votre planning',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: ViroSpacing.lg),
          ViroPrimaryButton(
            label: 'Créer ou rejoindre un club',
            onPressed: onJoin,
          ),
        ],
      ),
    );
  }
}
