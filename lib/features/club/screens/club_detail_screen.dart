import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/announcements/providers/announcement_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_overview_providers.dart';
import 'package:viro_team_v2/features/club/providers/role_requests_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_audience_switcher.dart';
import 'package:viro_team_v2/features/club/widgets/club_context_avatar.dart';
import 'package:viro_team_v2/features/club/widgets/club_hero_header.dart';
import 'package:viro_team_v2/features/club/widgets/club_management_list.dart';
import 'package:viro_team_v2/features/club/widgets/club_shortcuts_grid.dart';
import 'package:viro_team_v2/features/home/providers/home_teams_provider.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/features/members/widgets/my_parent_section.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/club/widgets/announcement_preview.dart';
import 'package:viro_team_v2/features/club/widgets/quick_actions_grid.dart';
import 'package:viro_team_v2/features/home/widgets/event_rsvp_card.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/planning/widgets/member_upcoming_events_list.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_detail_sheet.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/providers/session_provider.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/section_shimmer.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Fiche club : aperçu vivant (en-tête, prochain événement, à faire,
/// raccourcis informatifs, gestion) ou vue famille quand un enfant est
/// sélectionné.
class ClubDetailScreen extends ConsumerStatefulWidget {
  const ClubDetailScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubDetailScreen> createState() => _ClubDetailScreenState();
}

class _ClubDetailScreenState extends ConsumerState<ClubDetailScreen> {
  final _hiddenPendingIds = <String>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncSession());
  }

  void _syncSession() {
    final user = ref.read(viroUserProvider).value;
    ref.read(sessionProvider.notifier).setActiveClub(
          widget.clubId,
          role: user?.membershipInClub(widget.clubId)?.role,
        );
  }

  Future<void> _setRsvp(ClubEvent event, RsvpStatus status) async {
    final authUid = ref.read(authStateProvider).value?.uid;
    if (authUid == null) return;

    final target = ref.read(selectedClubAudienceProvider(widget.clubId));
    final eventService = ref.read(eventServiceProvider);
    final viaCallable = target?.isChild == true;

    // Optimistic : l'événement quitte « à répondre » tout de suite, et y
    // revient si la résolution d'audience ou l'écriture échoue.
    setState(() => _hiddenPendingIds.add(event.id));

    try {
      final audienceId = target?.memberId ??
          await eventService.resolveAudienceId(
            clubId: event.clubId,
            authUid: authUid,
          );
      await eventService.updateRsvp(
        clubId: event.clubId,
        eventId: event.id,
        uid: audienceId,
        status: status,
        viaCallable: viaCallable,
      );
    } catch (_) {
      if (mounted) {
        setState(() => _hiddenPendingIds.remove(event.id));
        ViroSnackBar.show(context, AppCopy.club.rsvpFailed);
      }
    }
  }

  /// Ouvre le détail d'un événement (même feuille que l'accueil).
  void _showEventDetail({
    required ClubEvent event,
    required Map<String, ClubTeam> teams,
    required bool canManageEvents,
  }) {
    final members = ref.read(clubMembersProvider(event.clubId)).value;
    PlanningEventDetailSheet.show(
      context: context,
      clubId: event.clubId,
      event: event,
      teamLabel: PlanningEventDisplay.teamLabel(event, teams),
      excludeCoachUids: PlanningEventDisplay.coachUidsToExclude(
        event,
        teams,
        membersByUid: members != null ? indexClubMembersByUid(members) : null,
      ),
      canManageEvents: canManageEvents,
      onCanceled: () {},
      onRsvpUpdated: () => ref.invalidate(memberEventsProvider),
    );
  }

  /// Recharge la fiche club sans bloquer indéfiniment sur les StreamProviders.
  Future<void> _refreshClub() async {
    final clubId = widget.clubId;
    final selected = ref.read(selectedClubAudienceProvider(clubId));
    final isChildView = selected?.isChild == true;

    ref.invalidate(clubMemberProvider(clubId));
    ref.invalidate(memberEventsProvider);
    ref.invalidate(clubAnnouncementsProvider(clubId));
    ref.invalidate(myTeamsProvider(clubId));
    ref.invalidate(homeClubTeamsProvider);
    if (isChildView && selected != null) {
      ref.invalidate(
        clubEventsForMemberProvider(
          (clubId: clubId, memberId: selected.memberId),
        ),
      );
      ref.invalidate(clubAudienceMemberProvider(clubId));
    }

    await Future.wait([
      ref.refresh(clubProvider(clubId).future),
      ref.refresh(clubAttendanceRateProvider(clubId).future),
      ref.refresh(clubPitchAttendanceRateProvider(clubId).future),
    ]);

    final streamWaits = <Future<Object?>>[
      ref.read(clubMemberProvider(clubId).future),
      ref.read(memberEventsProvider.future),
      ref.read(clubAnnouncementsProvider(clubId).future),
    ];
    if (isChildView && selected != null) {
      streamWaits.add(
        ref.read(
          clubEventsForMemberProvider(
            (clubId: clubId, memberId: selected.memberId),
          ).future,
        ),
      );
      streamWaits.add(ref.read(clubAudienceMemberProvider(clubId).future));
    }

    try {
      await Future.wait(streamWaits).timeout(const Duration(seconds: 8));
    } on TimeoutException {
      // L’indicateur se ferme quand même ; les streams peuvent rattraper ensuite.
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final clubAsync = ref.watch(clubProvider(clubId));
    final memberAsync = ref.watch(clubMemberProvider(clubId));
    final selected = ref.watch(selectedClubAudienceProvider(clubId));
    final isChildView = selected?.isChild == true;
    final familyChildAsync = isChildView
        ? ref.watch(clubAudienceMemberProvider(clubId))
        : const AsyncValue<ClubMember?>.data(null);
    final eventsAsync = isChildView && selected != null
        ? ref.watch(
            clubEventsForMemberProvider(
              (clubId: clubId, memberId: selected.memberId),
            ),
          )
        : ref.watch(clubEventsProvider(clubId));
    final announcementsAsync =
        ref.watch(visibleClubAnnouncementsProvider(clubId));
    final memberAccent = ref.watch(clubMemberAccentProvider(clubId));

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
      fallbackRoute: AppRoutes.home,
      appBar: ViroAppBar(
        fallbackRoute: AppRoutes.home,
        title: Text(clubAsync.value?.name ?? ProjectConfig.appName),
        onTitleTap: () => context.go(AppRoutes.home),
      ),
      body: clubAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => ViroErrorState(
          onRetry: () => ref.invalidate(clubProvider(clubId)),
        ),
        data: (club) {
          if (club == null) {
            return Center(child: Text(AppCopy.common.clubNotFound));
          }

          final brandColors = resolveClubBrandColors(
            brandColorHex: club.brandColorHex,
            clubId: club.id,
          );
          final memberAccent = brandColors.memberZoneColor;
          final managementAccent = brandColors.managementZoneColor;

          return ViroRefreshIndicator(
            onRefresh: _refreshClub,
            child: CustomScrollView(
            physics: ViroRefreshIndicator.scrollPhysics,
            slivers: [
              if (isChildView && selected != null) ...[
                SliverToBoxAdapter(
                  child: _ClubHeader(
                    club: club,
                    familyChild: familyChildAsync.value,
                    accent: memberAccent,
                  ),
                ),
                SliverToBoxAdapter(
                  child: ClubAudienceSwitcher(clubId: clubId),
                ),
                SliverToBoxAdapter(
                  child: _FamilyContextBanner(
                    childLabel: selected.label,
                    accent: memberAccent,
                  ),
                ),
                ..._buildFamilySlivers(
                  club: club,
                  memberAccent: memberAccent,
                  managementAccent: managementAccent,
                  accentSecondary: brandColors.secondary,
                  childMemberId: selected.memberId,
                  childLabel: selected.label,
                  eventsAsync: eventsAsync,
                  announcementsAsync: announcementsAsync,
                ),
              ] else
                ..._buildMemberSlivers(
                  club: club,
                  member: memberAsync.value,
                  eventsAsync: eventsAsync,
                  announcementsAsync: announcementsAsync,
                  memberAccent: memberAccent,
                  managementAccent: managementAccent,
                  accentSecondary: brandColors.secondary,
                ),
            ],
          ),
          );
        },
      ),
      ),
    );
  }

  /// Vue membre : en-tête, prochain événement, à faire, raccourcis, gestion.
  List<Widget> _buildMemberSlivers({
    required Club club,
    required ClubMember? member,
    required AsyncValue<ClubEventsState> eventsAsync,
    required AsyncValue<List<ClubAnnouncement>> announcementsAsync,
    required Color memberAccent,
    required Color managementAccent,
    Color? accentSecondary,
  }) {
    final clubId = club.id;
    final role = member?.role;
    final isCoachOrAbove =
        role != null && MemberRoleHierarchy.isCoachOrAbove(role);
    final isAdmin = role == MemberRoles.admin;
    final summary = ref.watch(clubShortcutsSummaryProvider(clubId));
    final attendanceRate = ref.watch(clubAttendanceRateProvider(clubId)).value;
    final pitchRate = ref.watch(clubPitchAttendanceRateProvider(clubId)).value;
    final hasActiveSeason =
        ref.watch(activeSeasonProvider(clubId)).value != null;
    final pendingCount = isCoachOrAbove
        ? ref.watch(pendingTeamMembersProvider(clubId)).value?.length ?? 0
        : 0;
    final latestAnnouncement = announcementsAsync.value?.firstOrNull;
    final roleRequestCount = isAdmin
        ? ref.watch(actionableRoleRequestsProvider(clubId)).value?.length ?? 0
        : 0;

    final heroStats = [
      if (club.memberCount > 0)
        ClubHeroStat(
          icon: ViroIcons.groups,
          label: AppCopy.club.membersCount(club.memberCount),
          onTap: isCoachOrAbove
              ? () => context.push(AppRoutes.clubMembersPath(clubId))
              : null,
        ),
      if (summary.teamNames != null && summary.teamNames!.isNotEmpty)
        ClubHeroStat(
          icon: ViroIcons.users,
          label: AppCopy.club.heroTeams(summary.teamNames!.length),
          onTap: () => context.push(AppRoutes.clubMyTeamsPath(clubId)),
        ),
      if (attendanceRate != null)
        ClubHeroStat(
          icon: ViroIcons.checkCircle,
          label: AppCopy.club.heroAttendance(attendanceRate.round()),
        ),
      if (pitchRate != null)
        ClubHeroStat(
          icon: ViroIcons.whistle,
          label: AppCopy.club.heroPitchAttendance(pitchRate.round()),
        ),
    ];

    return [
      SliverToBoxAdapter(
        child: ClubHeroHeader(
          club: club,
          accent: memberAccent,
          accentSecondary: accentSecondary,
          role: role,
          stats: heroStats,
          onEditAppearance: isAdmin
              ? () => context.push(AppRoutes.clubAppearancePath(clubId))
              : null,
        ),
      ),
      SliverToBoxAdapter(child: ClubAudienceSwitcher(clubId: clubId)),
      ..._buildNextEventAndTodoSlivers(
        club: club,
        eventsAsync: eventsAsync,
        fee: summary.fee,
        roleRequestCount: roleRequestCount,
        accent: memberAccent,
        accentSecondary: accentSecondary,
      ),
      if (member != null) ...[
        SliverToBoxAdapter(
          child: _SectionTitle(
            title: AppCopy.club.shortcutsSection,
            accentColor: memberAccent,
          ),
        ),
        SliverToBoxAdapter(
          child: ClubShortcutsGrid(
            accentColor: memberAccent,
            shortcuts: buildMemberShortcuts(
              summary: summary,
              latestAnnouncementTitle: latestAnnouncement == null
                  ? null
                  : _announcementHeadline(latestAnnouncement),
              onPlanning: () =>
                  context.push(AppRoutes.clubPlanningPath(clubId)),
              onTeams: () => context.push(AppRoutes.clubMyTeamsPath(clubId)),
              onAnnouncements: () =>
                  context.push(AppRoutes.clubAnnouncementsPath(clubId)),
              onMyFee: hasActiveSeason
                  ? () => context.push(AppRoutes.clubMyFeePath(clubId))
                  : null,
            ),
          ),
        ),
        if (member.role == MemberRoles.player)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
              ),
              child: MyParentSection(
                club: club,
                member: member,
                accentColor: memberAccent,
              ),
            ),
          ),
        if (isCoachOrAbove) ...[
          SliverToBoxAdapter(
            child: _SectionTitle(
              title: AppCopy.club.clubStaffSection(member.role),
              accentColor: managementAccent,
            ),
          ),
          SliverToBoxAdapter(
            child: ClubManagementList(
              role: member.role,
              accentColor: managementAccent,
              memberCount: club.memberCount,
              pendingCount: pendingCount,
              onMembers: () => context.push(AppRoutes.clubMembersPath(clubId)),
              onActivity: () =>
                  context.push(AppRoutes.clubActivityPath(clubId)),
              onFees: () => context.push(AppRoutes.clubFeesPath(clubId)),
              onAppearance: () =>
                  context.push(AppRoutes.clubAppearancePath(clubId)),
              onLocations: () =>
                  context.push(AppRoutes.clubLocationsPath(clubId)),
              onEquipment: () =>
                  context.push(AppRoutes.clubEquipmentPath(clubId)),
              onSettings: () =>
                  context.push(AppRoutes.clubSettingsPath(clubId)),
            ),
          ),
        ],
      ],
      const SliverToBoxAdapter(child: SizedBox(height: ViroSpacing.xl)),
    ];
  }

  /// Première ligne d'une annonce, pour la carte de raccourci.
  String _announcementHeadline(ClubAnnouncement announcement) =>
      announcement.message.trim().split('\n').first;

  /// « Prochain événement » (toujours visible, RSVP intégré) puis « À faire »
  /// (autres convocations sans réponse, cotisation à régler) s'il y a lieu.
  List<Widget> _buildNextEventAndTodoSlivers({
    required Club club,
    required AsyncValue<ClubEventsState> eventsAsync,
    required ClubFeeSummary? fee,
    required int roleRequestCount,
    required Color accent,
    Color? accentSecondary,
  }) {
    final clubId = club.id;
    final feeDue = fee != null && fee.kind == ClubFeeSummaryKind.due;
    final hasRoleRequests = roleRequestCount > 0;

    return eventsAsync.when(
      loading: () => [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(ViroSpacing.screenHorizontal),
            child: SectionShimmer(itemCount: 1),
          ),
        ),
      ],
      error: (_, __) => [
        SliverToBoxAdapter(
          child: ViroErrorState(
            onRetry: () => ref.invalidate(memberEventsProvider),
          ),
        ),
      ],
      data: (state) {
        final next = state.upcoming.where((e) => !e.canceled).firstOrNull;
        final otherPending = state.pending
            .where((e) => e.id != next?.id && !_hiddenPendingIds.contains(e.id))
            .toList();
        final teamsByClub = ref.watch(homeClubTeamsProvider).value ??
            const <String, Map<String, ClubTeam>>{};

        return [
          SliverToBoxAdapter(
            child: _SectionTitle(
              title: AppCopy.club.nextEventSection,
              accentColor: accent,
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.screenHorizontal,
            ),
            sliver: SliverToBoxAdapter(
              child: next == null
                  ? ViroCard(
                      elevated: false,
                      child: Text(
                        AppCopy.club.noUpcomingEvent,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: context.viroPalette.textSecondary,
                            ),
                      ),
                    )
                  : MemberUpcomingEventsList(
                      events: [next],
                      maxEvents: 1,
                      clubNames: {clubId: club.name},
                      clubColors: {clubId: accent},
                      clubSecondaryColors: {clubId: accentSecondary},
                      teamsByClub: teamsByClub,
                      onShowDetail: _showEventDetail,
                      onSetRsvp: (event, status) => setMemberEventRsvp(
                        ref: ref,
                        context: context,
                        event: event,
                        status: status,
                        failureMessage: AppCopy.club.rsvpFailed,
                      ),
                    ),
            ),
          ),
          if (otherPending.isNotEmpty || feeDue || hasRoleRequests) ...[
            SliverToBoxAdapter(
              child: _SectionTitle(
                title: AppCopy.club.todoSection,
                accentColor: accent,
              ),
            ),
            if (hasRoleRequests)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.screenHorizontal,
                  0,
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.md,
                ),
                sliver: SliverToBoxAdapter(
                  child: _TodoLinkCard(
                    icon: ViroIcons.users,
                    title: AppCopy.club.roleRequestsTodo(roleRequestCount),
                    subtitle: AppCopy.club.roleRequestsTodoHint,
                    accent: accent,
                    onTap: () =>
                        context.push(AppRoutes.clubRoleRequestsPath(clubId)),
                  ),
                ),
              ),
            if (feeDue)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.screenHorizontal,
                  0,
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.md,
                ),
                sliver: SliverToBoxAdapter(
                  child: _FeeDueBanner(
                    title: AppCopy.club.feeDueTodo(
                      formatFeeAmountCents(fee.remainingCents),
                    ),
                    onTap: () => context.push(AppRoutes.clubMyFeePath(clubId)),
                  ),
                ),
              ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
              ),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final event = otherPending[index];
                    return EventRsvpCard(
                      event: event,
                      clubName: club.name,
                      clubColor: accent,
                      clubColorSecondary: accentSecondary,
                      onPresent: () => _setRsvp(event, RsvpStatus.yes),
                      onAbsent: () => _setRsvp(event, RsvpStatus.no),
                    );
                  },
                  childCount: otherPending.length,
                ),
              ),
            ),
          ],
        ];
      },
    );
  }

  List<Widget> _buildFamilySlivers({
    required Club club,
    required Color memberAccent,
    required Color managementAccent,
    Color? accentSecondary,
    required String childMemberId,
    required String childLabel,
    required AsyncValue<ClubEventsState> eventsAsync,
    required AsyncValue<List<ClubAnnouncement>> announcementsAsync,
  }) {
    final clubId = club.id;
    final feeAsync = ref.watch(
      myFeeProvider((clubId: clubId, memberId: childMemberId)),
    );

    return [
      ...eventsAsync.when(
        loading: () => [
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(ViroSpacing.screenHorizontal),
              child: SectionShimmer(itemCount: 1),
            ),
          ),
        ],
        error: (_, __) => [
          const SliverToBoxAdapter(child: ViroErrorState()),
        ],
        data: (state) {
          final next = state.upcoming.firstOrNull;
          if (next == null) {
            return [
              SliverToBoxAdapter(
                child: _SectionTitle(
                  title: AppCopy.club.nextEventSection,
                  accentColor: memberAccent,
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.screenHorizontal,
                  ),
                  child: Text(
                    AppCopy.club.noUpcomingForChild(childLabel),
                  ),
                ),
              ),
            ];
          }
          return [
            SliverToBoxAdapter(
              child: _SectionTitle(
                title: AppCopy.club.nextEventSection,
                accentColor: memberAccent,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
              ),
              sliver: SliverToBoxAdapter(
                child: EventRsvpCard(
                  event: next,
                  clubName: club.name,
                  clubColor: memberAccent,
                  clubColorSecondary: accentSecondary,
                  onPresent: () => _setRsvp(next, RsvpStatus.yes),
                  onAbsent: () => _setRsvp(next, RsvpStatus.no),
                ),
              ),
            ),
          ];
        },
      ),
      ...feeAsync.when(
        loading: () => const <Widget>[],
        error: (_, __) => const <Widget>[],
        data: (data) {
          final season = data.season;
          final fee = data.fee;
          if (season == null || fee == null) return const <Widget>[];
          if (fee.status != MemberFeeStatus.aPayer &&
              fee.status != MemberFeeStatus.partiel) {
            return const <Widget>[];
          }
          final remaining = fee.remainingCents(season);
          if (remaining <= 0 && fee.pendingAidsCents <= 0) {
            return const <Widget>[];
          }
          return [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.lg,
                  ViroSpacing.screenHorizontal,
                  0,
                ),
                child: _FeeDueBanner(
                  title: AppCopy.club.familyFeeBanner(childLabel),
                  subtitle: AppCopy.club.remainingDue(
                    formatFeeAmountCents(remaining),
                  ),
                  onTap: () => context.push(AppRoutes.clubMyFeePath(clubId)),
                ),
              ),
            ),
          ];
        },
      ),
      ..._buildAnnouncementsSlivers(
        announcementsAsync,
        clubId: clubId,
        accent: memberAccent,
      ),
      SliverToBoxAdapter(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionTitle(
              title: AppCopy.club.quickAccessSection,
              accentColor: memberAccent,
            ),
            FamilyQuickActionsGrid(
              accentColor: memberAccent,
              onPlanning: () => context.push(
                AppRoutes.clubPlanningPath(clubId),
              ),
              onFee: () => context.push(AppRoutes.clubMyFeePath(clubId)),
              onInfos: () => context.push(
                AppRoutes.clubAnnouncementsPath(clubId),
              ),
            ),
            const SizedBox(height: ViroSpacing.xl),
          ],
        ),
      ),
    ];
  }

  List<Widget> _buildAnnouncementsSlivers(
    AsyncValue<List<ClubAnnouncement>> announcementsAsync, {
    required String clubId,
    required Color accent,
  }) {
    return announcementsAsync.when(
      loading: () => const [],
      error: (_, __) => const [],
      data: (items) {
        if (items.isEmpty) return const [];
        final previews = items.take(3).toList();
        return [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _SectionTitle(title: AppCopy.club.announcementsSection, accentColor: accent),
                  ),
                  TextButton(
                    onPressed: () => context.push(
                      AppRoutes.clubAnnouncementsPath(clubId),
                    ),
                    child: Text(AppCopy.common.seeAll),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.screenHorizontal,
            ),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) => Padding(
                  padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
                  child: AnnouncementPreview(
                    announcement: previews[index],
                    accentColor: accent,
                  ),
                ),
                childCount: previews.length,
              ),
            ),
          ),
        ];
      },
    );
  }
}

/// En-tête de la vue famille (enfant sélectionné).
class _ClubHeader extends StatelessWidget {
  const _ClubHeader({
    required this.club,
    required this.accent,
    this.familyChild,
  });

  final Club club;
  final ClubMember? familyChild;
  final Color accent;

  String get _familyChildTitle {
    final child = familyChild;
    if (child == null) return club.name;
    final first = child.firstName?.trim() ?? '';
    if (first.isNotEmpty) return first;
    final full = child.fullName.trim();
    if (full.isNotEmpty) return full;
    return AppCopy.common.childFallback;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final isFamilyView = familyChild != null;
    final clubMeta = [
      if (isFamilyView) club.name,
      club.sport,
      if (club.city != null && club.city!.isNotEmpty) club.city,
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.all(ViroSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (isFamilyView)
            MemberAvatar(
              member: familyChild!,
              size: 72,
              accentColor: accent,
              showAccentBorder: true,
            )
          else
            ClubContextAvatar(
              club: club,
              accentColor: accent,
              size: 72,
              borderRadius: 18,
            ),
          const SizedBox(height: ViroSpacing.md),
          Text(
            isFamilyView ? _familyChildTitle : club.name,
            textAlign: TextAlign.center,
            style: theme.titleMedium?.copyWith(
              color: palette.brandText,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (isFamilyView) ...[
            const SizedBox(height: ViroSpacing.sm),
            const ViroRoleBadge(role: ViroRole.parent, compact: true),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              AppCopy.club.familyFollowingChild(_familyChildTitle),
              textAlign: TextAlign.center,
              style: theme.bodyMedium?.copyWith(
                color: palette.brandText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 4),
          Text(
            clubMeta,
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// Rappelle que la fiche club est ouverte en mode parent (infos enfant).
class _FamilyContextBanner extends StatelessWidget {
  const _FamilyContextBanner({
    required this.childLabel,
    required this.accent,
  });

  final String childLabel;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final readableAccent = palette.readableAccent(accent);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
        ViroSpacing.screenHorizontal,
        0,
      ),
      child: ViroCard(
        accentColor: accent,
        elevated: false,
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm + 2,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ViroIcon(
              ViroIcons.roleParent,
              size: 20,
              color: readableAccent,
            ),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppCopy.members.parentOf(childLabel),
                    style: theme.labelLarge?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    AppCopy.club.familyAccessHint,
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    this.accentColor,
  });

  final String title;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final titleStyle = Theme.of(context).textTheme.titleMedium?.copyWith(
          color: palette.brandText,
          fontWeight: FontWeight.w700,
        );

    return Padding(
      padding: EdgeInsets.fromLTRB(
        accentColor != null ? 0 : ViroSpacing.screenHorizontal,
        ViroSpacing.lg,
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
      ),
      child: Row(
        children: [
          if (accentColor != null) ...[
            Container(
              width: 3,
              height: 20,
              margin: const EdgeInsets.only(
                left: ViroSpacing.screenHorizontal,
                right: ViroSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
          Expanded(
            child: Text(title, style: titleStyle),
          ),
        ],
      ),
    );
  }
}

/// Bandeau orange « cotisation à régler » (vue membre et vue famille).
class _FeeDueBanner extends StatelessWidget {
  const _FeeDueBanner({
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: ViroColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        border: Border.all(color: ViroColors.warning.withValues(alpha: 0.4)),
      ),
      child: ViroPressable(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.md),
          child: Row(
            children: [
              ViroIcon(ViroIcons.payments, color: ViroColors.warning, size: 22),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.warningText,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: theme.bodyMedium?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                  ],
                ),
              ),
              ViroIcon(
                ViroIcons.chevronRight,
                color: palette.textMuted,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ligne « à regarder » discrète (ex. demandes de rôle) : une seule entrée
/// résumée, jamais la liste complète, pour ne pas charger la fiche.
class _TodoLinkCard extends StatelessWidget {
  const _TodoLinkCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final iconColor = palette.readableAccent(accent);

    return ViroCard(
      margin: EdgeInsets.zero,
      onTap: onTap,
      semanticLabel: title,
      padding: const EdgeInsets.all(ViroSpacing.md),
      child: Row(
        children: [
          ViroIcon(icon, color: iconColor, size: 22),
          const SizedBox(width: ViroSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.titleSmall?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  subtitle,
                  style: theme.bodySmall?.copyWith(
                    color: palette.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          ViroIcon(ViroIcons.chevronRight, color: palette.textMuted, size: 20),
        ],
      ),
    );
  }
}
