import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_audience_switcher.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/widgets/common/portal_admin_banner.dart';
import 'package:viro_team_v2/features/planning/providers/planning_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_day_picker.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_detail_sheet.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_tile.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class ClubPlanningScreen extends ConsumerStatefulWidget {
  const ClubPlanningScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubPlanningScreen> createState() => _ClubPlanningScreenState();
}

class _ClubPlanningScreenState extends ConsumerState<ClubPlanningScreen> {
  final _dayScrollController = ScrollController();
  List<DateTime> _days = [];
  bool _daysReady = false;
  bool _portalBannerDismissed = false;
  late DateTime _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedDay = DateTime(now.year, now.month, now.day);
    _initDays();
  }

  Future<void> _initDays() async {
    final first = await ref
        .read(eventServiceProvider)
        .getFirstEventDate(widget.clubId);
    if (!mounted) return;
    setState(() {
      _days = buildPlanningDays(firstEventDate: first);
      _daysReady = true;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      scrollPlanningToDay(
        controller: _dayScrollController,
        days: _days,
        day: _selectedDay,
      );
    });
  }

  @override
  void dispose() {
    _dayScrollController.dispose();
    super.dispose();
  }

  void _selectDay(DateTime day) {
    setState(() => _selectedDay = day);
    scrollPlanningToDay(
      controller: _dayScrollController,
      days: _days,
      day: day,
    );
  }

  void _showEventSheet(
    ClubEvent event,
    Map<String, ClubTeam> teamsById, {
    required bool canManage,
  }) {
    PlanningEventDetailSheet.show(
      context: context,
      ref: ref,
      clubId: widget.clubId,
      event: event,
      teamLabel: PlanningEventDisplay.teamLabel(event, teamsById),
      excludeCoachUids: PlanningEventDisplay.coachUidsToExclude(
        event,
        teamsById,
        membersByUid: ref.read(clubMembersProvider(widget.clubId)).value != null
            ? indexClubMembersByUid(
                ref.read(clubMembersProvider(widget.clubId)).value!,
              )
            : null,
      ),
      canManageEvents: canManage,
      onCanceled: () {},
    );
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final member = ref.watch(clubMemberProvider(clubId)).value;
    final target = ref.watch(selectedClubAudienceProvider(clubId));
    final isChildView = target?.isChild == true;
    final canManage = !isChildView &&
        member != null &&
        MemberRoleHierarchy.isCoachOrAbove(member.role);
    final isAdmin = !isChildView && member?.role == MemberRoles.admin;
    final isBureauMember = !isChildView &&
        member != null &&
        (member.role == MemberRoles.admin ||
            member.role == MemberRoles.coach ||
            member.role == MemberRoles.player);
    final familyTargets =
        ref.watch(clubFamilyTargetsProvider(clubId)).value ?? const [];
    final isParent = familyTargets.any((t) => t.isChild);
    final dayParams = (clubId: clubId, day: _selectedDay);
    final eventsAsync = canManage
        ? ref.watch(clubPlanningEventsProvider(dayParams))
        : ref.watch(memberClubPlanningEventsProvider(dayParams));
    final teamsAsync = ref.watch(clubTeamsProvider(clubId));
    final clubMembers = member != null
        ? ref.watch(clubMembersProvider(clubId)).value
        : null;
    final membersByUid =
        clubMembers != null ? indexClubMembersByUid(clubMembers) : null;

    final club = ref.watch(clubProvider(clubId)).value;
    final clubColor = club != null
        ? clubAccentColor(brandColorHex: club.brandColorHex, clubId: clubId)
        : null;

    final teamsById = teamsAsync.value?.fold<Map<String, ClubTeam>>(
          {},
          (map, t) => map..[t.id] = t,
        ) ??
        {};

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text('Planning'),
        actions: [
          IconButton(
            icon: ViroIcon(ViroIcons.calendarPlus),
            tooltip: 'Exporter vers mon agenda',
            onPressed: () => context.push(
              AppRoutes.clubCalendarSyncPath(clubId),
            ),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!DateUtils.isSameDay(_selectedDay, DateTime.now()))
            Padding(
              padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
              child: ViroPressable(
                onTap: () => _selectDay(
                  DateTime(DateTime.now().year, DateTime.now().month,
                      DateTime.now().day),
                ),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: ViroColors.surfaceCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: clubColor ?? ViroColors.primary600,
                      width: 2,
                    ),
                    boxShadow: ViroMotion.floatingShadow(
                        opacity: 0.16, blur: 18, y: 5),
                  ),
                  child: _TodayCalendarIcon(
                    day: DateTime.now().day,
                    color: clubColor ?? ViroColors.primary600,
                  ),
                ),
              ),
            ),
          if (canManage)
            ViroFloatingActionButton(
              icon: ViroIcons.add,
              onPressed: () {
                final iso = _selectedDay.toIso8601String().split('T').first;
                context.push(AppRoutes.clubAddEventPath(clubId, date: iso));
              },
            ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClubAudienceSwitcher(clubId: clubId),
          if ((isBureauMember || isParent) && !_portalBannerDismissed)
            PortalAdminBanner(
              portalUrl: portalPlanningUrl(clubId: clubId),
              compact: true,
              message: isAdmin
                  ? 'Vue calendrier détaillée, filtres multi-équipes.'
                  : isParent
                      ? 'Planning et RSVP aussi disponibles sur le portail famille.'
                      : 'Planning et RSVP aussi disponibles sur le portail web.',
              ctaLabel: 'www.viroteam.com',
              onDismiss: () => setState(() => _portalBannerDismissed = true),
            ),
          const SizedBox(height: ViroSpacing.sm),
          if (!_daysReady)
            const SizedBox(
              height: 100,
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_days.isNotEmpty)
            PlanningDayPicker(
              days: _days,
              selectedDay: _selectedDay,
              scrollController: _dayScrollController,
              onDaySelected: _selectDay,
              clubId: clubId,
              useManagerView: canManage,
              todayBorderColor: clubColor,
            ),
          const Divider(height: 1, color: ViroColors.gray200),
          Expanded(
            child: ViroRefreshIndicator(
              onRefresh: () async {
                await Future.wait([
                  if (canManage)
                    ref.refresh(clubPlanningEventsProvider(dayParams).future)
                  else
                    ref.refresh(
                      memberClubPlanningEventsProvider(dayParams).future,
                    ),
                  ref.refresh(clubTeamsProvider(clubId).future),
                  ref.refresh(clubProvider(clubId).future),
                ]);
                await _initDays();
              },
              child: eventsAsync.when(
                loading: () => ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(
                      height: 240,
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ],
                ),
                error: (_, _) => ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 240, child: ViroErrorState()),
                  ],
                ),
                data: (events) {
                  if (events.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(ViroSpacing.xl),
                      children: [
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.35,
                          child: Center(
                            child: Text(
                              canManage
                                  ? 'Aucun événement ce jour-là.\nAppuyez sur + pour en créer un.'
                                  : 'Aucun événement ce jour-là.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: ViroColors.gray600),
                            ),
                          ),
                        ),
                      ],
                    );
                  }

                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(
                      ViroSpacing.screenHorizontal,
                      ViroSpacing.md,
                      ViroSpacing.screenHorizontal,
                      ViroSpacing.xl,
                    ),
                    itemCount: events.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: ViroSpacing.sm),
                    itemBuilder: (context, index) {
                      final event = events[index];
                      final label =
                          PlanningEventDisplay.teamLabel(event, teamsById);
                      final excludeCoaches =
                          PlanningEventDisplay.coachUidsToExclude(
                        event,
                        teamsById,
                        membersByUid: membersByUid,
                      );
                      return PlanningEventTile(
                        event: event,
                        teamLabel: label,
                        excludeCoachUids: excludeCoaches,
                        onTap: () => _showEventSheet(
                          event,
                          teamsById,
                          canManage: canManage,
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TodayCalendarIcon extends StatelessWidget {
  const _TodayCalendarIcon({required this.day, required this.color});

  final int day;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 22,
      height: 22,
      child: Column(
        children: [
          Container(
            height: 5,
            decoration: BoxDecoration(
              color: color,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
            ),
          ),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(color: color, width: 1.5),
                  right: BorderSide(color: color, width: 1.5),
                  bottom: BorderSide(color: color, width: 1.5),
                ),
                borderRadius:
                    const BorderRadius.vertical(bottom: Radius.circular(3)),
              ),
              alignment: Alignment.center,
              child: Text(
                '$day',
                style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
