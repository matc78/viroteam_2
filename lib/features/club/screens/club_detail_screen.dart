import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/announcements/providers/announcement_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_audience_switcher.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/club/widgets/announcement_preview.dart';
import 'package:viro_team_v2/features/club/widgets/club_stats_row.dart';
import 'package:viro_team_v2/features/club/widgets/quick_actions_grid.dart';
import 'package:viro_team_v2/features/home/widgets/event_rsvp_card.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/providers/session_provider.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/section_shimmer.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

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
    final audienceId = target?.memberId ??
        await eventService.resolveAudienceId(
          clubId: event.clubId,
          authUid: authUid,
        );
    final viaCallable = target?.isChild == true;

    setState(() => _hiddenPendingIds.add(event.id));

    try {
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
        ViroSnackBar.show(context, 'RSVP impossible, réessayez');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final clubAsync = ref.watch(clubProvider(clubId));
    final memberAsync = ref.watch(clubMemberProvider(clubId));
    final selected = ref.watch(selectedClubAudienceProvider(clubId));
    final isChildView = selected?.isChild == true;
    final eventsAsync = isChildView && selected != null
        ? ref.watch(
            clubEventsForMemberProvider(
              (clubId: clubId, memberId: selected.memberId),
            ),
          )
        : ref.watch(clubEventsProvider(clubId));
    final announcementsAsync =
        ref.watch(visibleClubAnnouncementsProvider(clubId));
    final attendanceAsync = ref.watch(clubAttendanceRateProvider(clubId));

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text(ProjectConfig.appName),
        onTitleTap: () => context.go(AppRoutes.home),
      ),
      body: clubAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const ViroErrorState(),
        data: (club) {
          if (club == null) {
            return const Center(child: Text('Club introuvable'));
          }

          final accent = clubAccentColor(
            brandColorHex: club.brandColorHex,
            clubId: club.id,
          );

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: _ClubHeader(
                  club: club,
                  member: isChildView ? null : memberAsync.value,
                  accent: accent,
                ),
              ),
              SliverToBoxAdapter(
                child: ClubAudienceSwitcher(clubId: clubId),
              ),
              if (isChildView && selected != null)
                ..._buildFamilySlivers(
                  club: club,
                  accent: accent,
                  childMemberId: selected.memberId,
                  childLabel: selected.label,
                  eventsAsync: eventsAsync,
                  announcementsAsync: announcementsAsync,
                )
              else ...[
                ..._buildEventsSlivers(
                  eventsAsync: eventsAsync,
                  club: club,
                  accent: accent,
                ),
                ..._buildStatsSlivers(
                  attendanceAsync: attendanceAsync,
                  eventsAsync: eventsAsync,
                  club: club,
                  member: memberAsync.value,
                ),
                ..._buildAnnouncementsSlivers(
                  announcementsAsync,
                  clubId: clubId,
                ),
                SliverToBoxAdapter(
                  child: memberAsync.when(
                    data: (m) {
                      if (m == null) return const SizedBox.shrink();

                      final hasActiveSeason = ref
                              .watch(activeSeasonProvider(clubId))
                              .value !=
                          null;

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _SectionTitle(title: 'Accès rapides'),
                          MemberQuickActionsGrid(
                            onPlanning: () => context.push(
                              AppRoutes.clubPlanningPath(clubId),
                            ),
                            onMyTeams: () => context.push(
                              AppRoutes.clubMyTeamsPath(clubId),
                            ),
                            onAnnouncements: () => context.push(
                              AppRoutes.clubAnnouncementsPath(clubId),
                            ),
                            onMyFee: hasActiveSeason
                                ? () => context.push(
                                      AppRoutes.clubMyFeePath(clubId),
                                    )
                                : null,
                          ),
                          if (MemberRoleHierarchy.isCoachOrAbove(m.role)) ...[
                            const _SectionTitle(title: 'Gestion du club'),
                            ClubManagementActionsGrid(
                              role: m.role,
                              onManageTeams: () => context.push(
                                AppRoutes.clubManageTeamsPath(clubId),
                              ),
                              onManageMembers: () => context.push(
                                AppRoutes.clubMembersPath(clubId),
                              ),
                              onFees: m.role == MemberRoles.admin
                                  ? () => context.push(
                                        AppRoutes.clubFeesPath(clubId),
                                      )
                                  : null,
                              onPortal: m.role == MemberRoles.admin
                                  ? () => openPortalUrl(
                                        portalHomeUrl(clubId: clubId),
                                      )
                                  : null,
                            ),
                          ],
                          const SizedBox(height: ViroSpacing.xl),
                        ],
                      );
                    },
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  List<Widget> _buildFamilySlivers({
    required Club club,
    required Color accent,
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
        error: (_, _) => [
          const SliverToBoxAdapter(child: ViroErrorState()),
        ],
        data: (state) {
          final next = state.upcoming.firstOrNull;
          if (next == null) {
            return [
              const SliverToBoxAdapter(
                child: _SectionTitle(title: 'Prochain événement'),
              ),
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: ViroSpacing.screenHorizontal,
                  ),
                  child: Text('Aucun événement à venir pour cette fiche.'),
                ),
              ),
            ];
          }
          return [
            const SliverToBoxAdapter(
              child: _SectionTitle(title: 'Prochain événement'),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
              ),
              sliver: SliverToBoxAdapter(
                child: EventRsvpCard(
                  event: next,
                  clubName: club.name,
                  clubColor: accent,
                  onPresent: () => _setRsvp(next, RsvpStatus.yes),
                  onMaybe: () => _setRsvp(next, RsvpStatus.maybe),
                  onAbsent: () => _setRsvp(next, RsvpStatus.no),
                ),
              ),
            ),
          ];
        },
      ),
      ...feeAsync.when(
        loading: () => const <Widget>[],
        error: (_, _) => const <Widget>[],
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
                child: _FamilyFeeBanner(
                  label: childLabel,
                  amountLabel: formatFeeAmountCents(remaining),
                  onTap: () => context.push(AppRoutes.clubMyFeePath(clubId)),
                ),
              ),
            ),
          ];
        },
      ),
      ..._buildAnnouncementsSlivers(announcementsAsync, clubId: clubId),
      SliverToBoxAdapter(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SectionTitle(title: 'Accès rapides'),
            FamilyQuickActionsGrid(
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

  List<Widget> _buildEventsSlivers({
    required AsyncValue<ClubEventsState> eventsAsync,
    required Club club,
    required Color accent,
  }) {
    return eventsAsync.when(
      loading: () => [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(ViroSpacing.screenHorizontal),
            child: SectionShimmer(itemCount: 2),
          ),
        ),
      ],
      error: (e, _) => [
        const SliverToBoxAdapter(child: ViroErrorState()),
      ],
      data: (state) {
        final pending = state.pending
            .where((e) => !_hiddenPendingIds.contains(e.id))
            .toList();
        return [
          if (pending.isNotEmpty) ...[
            const SliverToBoxAdapter(
              child: _SectionTitle(title: 'À répondre'),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
              ),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final event = pending[index];
                    return EventRsvpCard(
                      event: event,
                      clubName: club.name,
                      clubColor: accent,
                      onPresent: () => _setRsvp(event, RsvpStatus.yes),
                      onAbsent: () => _setRsvp(event, RsvpStatus.no),
                    );
                  },
                  childCount: pending.length,
                ),
              ),
            ),
          ],
        ];
      },
    );
  }

  List<Widget> _buildStatsSlivers({
    required AsyncValue<double?> attendanceAsync,
    required AsyncValue<ClubEventsState> eventsAsync,
    required Club club,
    required ClubMember? member,
  }) {
    final clubId = club.id;
    final canOpenMembers = member != null &&
        (member.role == MemberRoles.admin || member.role == MemberRoles.coach);

    ClubStatsRow buildRow({required double? rate, required ClubEvent? next}) {
      return ClubStatsRow(
        attendanceRate: rate,
        nextEvent: next,
        club: club,
        onMembersTap: canOpenMembers
            ? () => context.push(AppRoutes.clubMembersPath(clubId))
            : null,
      );
    }

    return attendanceAsync.when(
      loading: () => const [],
      error: (_, _) {
        final next = eventsAsync.value?.upcoming.firstOrNull;
        return [SliverToBoxAdapter(child: buildRow(rate: null, next: next))];
      },
      data: (rate) {
        final next = eventsAsync.value?.upcoming.firstOrNull;
        return [SliverToBoxAdapter(child: buildRow(rate: rate, next: next))];
      },
    );
  }

  List<Widget> _buildAnnouncementsSlivers(
    AsyncValue<List<ClubAnnouncement>> announcementsAsync, {
    required String clubId,
  }) {
    return announcementsAsync.when(
      loading: () => const [],
      error: (_, _) => const [],
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
                  const Expanded(child: _SectionTitle(title: 'Annonces')),
                  TextButton(
                    onPressed: () => context.push(
                      AppRoutes.clubAnnouncementsPath(clubId),
                    ),
                    child: const Text('Voir tout'),
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

class _ClubHeader extends StatelessWidget {
  const _ClubHeader({
    required this.club,
    required this.member,
    required this.accent,
  });

  final Club club;
  final ClubMember? member;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final subtitle = [
      club.sport,
      if (club.city != null && club.city!.isNotEmpty) club.city,
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.all(ViroSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: accent),
              image: club.logoUrl != null
                  ? DecorationImage(
                      image: NetworkImage(club.logoUrl!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            alignment: Alignment.center,
            child: club.logoUrl == null
                ? Text(
                    club.name.isNotEmpty ? club.name[0].toUpperCase() : '?',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: accent,
                    ),
                  )
                : null,
          ),
          const SizedBox(height: ViroSpacing.md),
          Text(
            club.name,
            textAlign: TextAlign.center,
            style: theme.titleMedium?.copyWith(
              color: ViroColors.primary800,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
          ),
          if (member != null) ...[
            const SizedBox(height: ViroSpacing.sm),
            ViroRoleBadge(
              role: viroRoleFromMemberRole(member!.role),
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.lg,
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
      ),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: ViroColors.primary800,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _FamilyFeeBanner extends StatelessWidget {
  const _FamilyFeeBanner({
    required this.label,
    required this.amountLabel,
    required this.onTap,
  });

  final String label;
  final String amountLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
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
                      'Cotisation de $label',
                      style: theme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ViroColors.primary800,
                      ),
                    ),
                    Text(
                      'Reste dû : $amountLabel',
                      style: theme.bodyMedium?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                  ],
                ),
              ),
              ViroIcon(
                ViroIcons.chevronRight,
                color: ViroColors.gray400,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
