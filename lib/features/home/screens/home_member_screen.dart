import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/chat/providers/chat_messaging_live_provider.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/home/providers/home_teams_provider.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/features/home/models/rsvp_push_highlight.dart';
import 'package:viro_team_v2/features/home/providers/rsvp_push_highlight_provider.dart';
import 'package:viro_team_v2/features/clubs/widgets/add_club_sheet.dart';
import 'package:viro_team_v2/features/home/widgets/club_selector_bar.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/planning/widgets/member_upcoming_events_list.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_detail_sheet.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/features/announcements/widgets/home_announcement_banner.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_reminder_banner.dart';
import 'package:viro_team_v2/features/home/widgets/home_quiet_content.dart';
import 'package:viro_team_v2/features/home/widgets/notification_soft_ask_sheet.dart';
import 'package:viro_team_v2/features/settings/widgets/analytics_consent_sheet.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/section_shimmer.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/common/viro_swipe_to_reveal.dart';
import 'package:viro_team_v2/features/chat/screens/conversations_screen.dart';

class HomeMemberScreen extends ConsumerStatefulWidget {
  const HomeMemberScreen({super.key});

  @override
  ConsumerState<HomeMemberScreen> createState() => _HomeMemberScreenState();
}

class _HomeMemberScreenState extends ConsumerState<HomeMemberScreen> {
  final _scrollController = ScrollController();
  final _swipeToMessagingKey = GlobalKey<ViroSwipeToRevealState>();
  GoRouter? _router;
  bool _highlightResolveScheduled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _offerNotifications());
    _scheduleRsvpHighlightResolve();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final router = GoRouter.of(context);
    if (router == _router) return;
    _router?.routerDelegate.removeListener(_clearRsvpHighlightOffHome);
    _router = router..routerDelegate.addListener(_clearRsvpHighlightOffHome);
  }

  /// Changement de page : le liseré des events (push RSVP) s'arrête.
  void _clearRsvpHighlightOffHome() {
    final path = _router?.routerDelegate.currentConfiguration.uri.path;
    if (path == AppRoutes.home) return;
    ref.read(rsvpPushHighlightProvider.notifier).clear();
  }

  /// Résout le liseré après le frame (events chargés ou liseré posé).
  void _scheduleRsvpHighlightResolve() {
    if (_highlightResolveScheduled) return;
    _highlightResolveScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _highlightResolveScheduled = false;
      if (mounted) _resolveRsvpHighlight();
    });
  }

  /// Events de la push affichés → compte à rebours ; aucun sur la home (coach
  /// hors audience, event lointain…) → planning d'origine du lien.
  void _resolveRsvpHighlight() {
    final highlight = ref.read(rsvpPushHighlightProvider);
    final events = ref.read(memberEventsProvider).value;
    final user = ref.read(viroUserProvider).value;
    // Auth pas prête : la liste vide est provisoire, on attend la suivante.
    final authReady = ref.read(firestoreAuthReadyProvider).value != null;
    if (highlight == null || events == null || user == null || !authReady) {
      return;
    }
    final notifier = ref.read(rsvpPushHighlightProvider.notifier);
    final keys = highlight.statusesByEventKey.keys.toSet();
    final shown = events.upcoming.any(
      (event) => keys.contains(RsvpPushHighlight.eventKey(event.clubId, event.id)),
    );
    if (shown) {
      notifier.startCountdown();
      return;
    }
    notifier.clear();
    if (!userCanOpenClub(user, highlight.clubId)) return;
    context.go(highlight.fallbackRoute);
  }

  /// Pré-demandes (mesure d'audience puis notifs) : seulement avec au moins
  /// un club, après un court délai pour laisser la home s'afficher. Une
  /// seule feuille par ouverture : les notifs attendent le lancement suivant
  /// si le consentement vient d'être demandé.
  Future<void> _offerNotifications() async {
    try {
      final clubs = await ref.read(userClubsProvider.future);
      if (clubs.isEmpty) return;
    } catch (_) {
      return;
    }
    await Future<void>.delayed(ProjectConfig.notificationSoftAskDelay);
    if (!mounted) return;
    if (await maybeShowAnalyticsConsent(context, ref)) return;
    if (!mounted) return;
    await maybeShowNotificationSoftAsk(context, ref);
  }

  @override
  void dispose() {
    _router?.routerDelegate.removeListener(_clearRsvpHighlightOffHome);
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
      clubId: event.clubId,
      event: event,
      teamLabel: PlanningEventDisplay.teamLabel(event, teams),
      excludeCoachUids: PlanningEventDisplay.coachUidsToExclude(event, teams),
      canManageEvents: canManageEvents,
      onCanceled: () {},
      onRsvpUpdated: () => ref.invalidate(memberEventsProvider),
    );
  }

  Future<void> _setRsvp(ClubEvent event, RsvpStatus status) =>
      setMemberEventRsvp(
        ref: ref,
        context: context,
        event: event,
        status: status,
        failureMessage: AppCopy.home.rsvpFailed,
      );

  /// Recharge la home sans bloquer indéfiniment sur les StreamProviders.
  Future<void> _refreshHome(WidgetRef ref) async {
    ref.invalidate(memberEventsProvider);
    ref.invalidate(homeClubTeamsProvider);
    ref.invalidate(userClubsWithEventsProvider);

    await Future.wait([
      ref.refresh(userClubsProvider.future),
      ref.refresh(viroUserFutureProvider.future),
    ]);

    try {
      await Future.wait([
        ref.read(memberEventsProvider.future),
        ref.read(homeClubTeamsProvider.future),
      ]).timeout(const Duration(seconds: 8));
    } on TimeoutException {
      // L’indicateur se ferme quand même ; les streams peuvent rattraper ensuite.
    }
  }

  /// Ouvre la messagerie via la bulle chat (expand circulaire).
  void _openMessagingFromBubble(Offset bubbleOrigin) {
    if (!ref.read(chatMessagingLiveProvider)) return;
    _swipeToMessagingKey.currentState?.reset();
    context.push(AppRoutes.conversations, extra: bubbleOrigin);
  }

  /// Finalise le swipe interactif → route messagerie sans rejouer le slide.
  void _commitMessagingFromSwipe() {
    if (!ref.read(chatMessagingLiveProvider)) return;
    context.push(
      AppRoutes.conversations,
      extra: const ConversationsSwipeCommit(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final clubsAsync = ref.watch(userClubsProvider);
    final eventsAsync = ref.watch(memberEventsProvider);
    final teamsByClub = ref.watch(homeClubTeamsProvider).value ??
        const <String, Map<String, ClubTeam>>{};
    final pendingCounts = ref.watch(pendingCountByClubProvider);
    final userAsync = ref.watch(viroUserProvider);
    final chatMessagingLive = ref.watch(chatMessagingLiveProvider);
    final highlightStatuses =
        ref.watch(rsvpPushHighlightProvider)?.statusesByEventKey ??
            const <String, RsvpStatus>{};
    ref.listen(
      rsvpPushHighlightProvider,
      (_, _) => _scheduleRsvpHighlightResolve(),
    );
    ref.listen(memberEventsProvider, (_, _) => _scheduleRsvpHighlightResolve());

    return ViroSwipeToReveal(
      key: _swipeToMessagingKey,
      enabled: chatMessagingLive,
      reveal: const ConversationsScreen(),
      onCommit: _commitMessagingFromSwipe,
      child: ViroScaffold(
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
              icon: ViroIcon(
                ViroIcons.settings,
                shadows: context.viroPalette
                    .neonGlow(context.viroPalette.accent),
              ),
              onPressed: () => context.push(AppRoutes.userSettings),
            ),
          ],
        ),
        body: clubsAsync.when(
          loading: () => const Center(child: ViroLogoLoader()),
          error: (e, _) => ViroErrorState(
            message: AppCopy.home.loadClubsError,
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
                    message: AppCopy.home.loadPlanningError,
                    onRetry: () => ref.invalidate(memberEventsProvider),
                  ),
                  data: (state) {
                    final isFullyQuiet = state.upcoming.isEmpty;
                    final previewCount = memberHomePreviewCount(
                      state.upcoming,
                      highlightedKeys: highlightStatuses.keys,
                    );
                    final firstName = userAsync.value?.firstName;

                    return ViroRefreshIndicator(
                      onRefresh: () => _refreshHome(ref),
                      child: CustomScrollView(
                        physics: ViroRefreshIndicator.scrollPhysics,
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
                                title: AppCopy.home.upcomingPlanningTitle,
                              ),
                            ),
                            MemberUpcomingEventsSliver(
                              events: state.upcoming,
                              clubNames: names,
                              clubColors: colors,
                              clubSecondaryColors: secondaryColors,
                              teamsByClub: teamsByClub,
                              maxEvents: previewCount,
                              highlightStatuses: highlightStatuses,
                              onShowDetail: _showEventDetail,
                              onSetRsvp: _setRsvp,
                            ),
                            if (state.upcoming.length > previewCount)
                              SliverToBoxAdapter(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    ViroSpacing.screenHorizontal,
                                    0,
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.lg,
                                  ),
                                  child: ViroPrimaryButton(
                                    label: AppCopy.home.seeAllPlanning,
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
                          SliverToBoxAdapter(
                            child: SizedBox(
                              height: ClubSelectorBar.bottomClearance(context),
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
                  bottom: 0,
                  child: ClubSelectorBar(
                    clubs: clubs,
                    pendingByClub: pendingCounts,
                    onAddClub: () => showAddClubSheet(context, ref),
                    onOpenChat:
                        chatMessagingLive ? _openMessagingFromBubble : null,
                  ),
                ),
              ],
            );
          },
        ),
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
    final palette = context.viroPalette;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.md,
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
      ),
      child: Row(
        children: [
          ViroIcon(icon, size: 20, color: palette.brandText),
          const SizedBox(width: ViroSpacing.sm),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: palette.brandText,
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
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.screenHorizontal,
        ViroSpacing.screenHorizontal,
        ClubSelectorBar.bottomClearance(context),
      ),
      child: const Column(
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
            AppCopy.home.joinClubForPlanning,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: ViroSpacing.lg),
          ViroPrimaryButton(
            label: AppCopy.home.createOrJoinClub,
            onPressed: onJoin,
          ),
        ],
      ),
    );
  }
}
