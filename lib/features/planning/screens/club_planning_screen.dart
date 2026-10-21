import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/features/club/widgets/club_audience_switcher.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/features/planning/providers/planning_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/features/home/widgets/planning_day_section_header.dart';
import 'package:viro_team_v2/features/planning/utils/planning_calendar_range.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_day_picker.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_detail_sheet.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_event_tile.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_focused_event_highlight.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_month_grid.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_period_header.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_view_mode_switcher.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_week_agenda.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

class ClubPlanningScreen extends ConsumerStatefulWidget {
  const ClubPlanningScreen({
    super.key,
    required this.clubId,
    this.initialDate,
    this.focusEventId,
  });

  final String clubId;
  final DateTime? initialDate;

  /// Event à mettre en avant à l’ouverture (tap sur une notif).
  final String? focusEventId;

  @override
  ConsumerState<ClubPlanningScreen> createState() => _ClubPlanningScreenState();
}

class _ClubPlanningScreenState extends ConsumerState<ClubPlanningScreen> {
  final _dayScrollController = ScrollController();
  List<DateTime> _days = [];
  bool _daysReady = false;
  DateTime? _firstEventDate;
  late DateTime _selectedDay;

  /// Event mis en avant ; oublié dès que l’utilisateur change de jour.
  String? _focusEventId;

  /// Vue choisie (coach-admin) ; les autres profils restent en vue jour.
  PlanningViewMode _viewMode = PlanningViewMode.day;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final initial = widget.initialDate;
    _selectedDay = initial != null
        ? DateTime(initial.year, initial.month, initial.day)
        : DateTime(now.year, now.month, now.day);
    _focusEventId = widget.focusEventId;
    _initDays();
  }

  Future<void> _initDays() async {
    DateTime? first;
    try {
      final user = await ref.read(viroUserFutureProvider.future);
      final eventService = ref.read(eventServiceProvider);
      if (user != null && user.isGuardianOnlyInClub(widget.clubId)) {
        final teamIds = await loadGuardianChildTeamIds(
          guardianService: ref.read(guardianServiceProvider),
          user: user,
          clubId: widget.clubId,
        );
        first = await eventService.getFirstEventDateForTeams(
          clubId: widget.clubId,
          teamIds: teamIds,
        );
      } else {
        first = await eventService.getFirstEventDate(widget.clubId);
      }
    } catch (_) {
      first = null;
    }
    if (!mounted) return;
    setState(() {
      _firstEventDate = first;
      _days = _buildPickerDays();
      _daysReady = true;
    });
    _scrollPickerToSelectedDay();
  }

  /// Jours du bandeau : du premier événement (ou du jour sélectionné s'il est
  /// antérieur) jusqu'à l'horizon par défaut, étendu au jour sélectionné
  /// s'il est plus loin (atteint via la vue semaine / mois ou un lien daté).
  List<DateTime> _buildPickerDays() {
    final first = _firstEventDate;
    final earliest =
        first == null || _selectedDay.isBefore(first) ? _selectedDay : first;
    final daysAhead = calendarDaysBetween(DateTime.now(), _selectedDay);
    return buildPlanningDays(
      firstEventDate: earliest,
      futureDays: math.max(daysAhead, planningPickerFutureDays),
    );
  }

  void _scrollPickerToSelectedDay() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      scrollPlanningToDay(
        controller: _dayScrollController,
        days: _days,
        day: _selectedDay,
      );
    });
  }

  /// Vue effective : semaine / mois réservées à ceux qui gèrent le planning.
  PlanningViewMode _effectiveViewMode({required bool canManage}) =>
      canManage ? _viewMode : PlanningViewMode.day;

  ({String clubId, DateTime start, DateTime endExclusive}) _rangeParams(
    PlanningViewMode mode,
  ) {
    final range = planningPeriodRange(mode, _selectedDay);
    return (
      clubId: widget.clubId,
      start: range.start,
      endExclusive: range.endExclusive,
    );
  }

  void _setViewMode(PlanningViewMode mode) {
    if (mode == _viewMode) return;
    setState(() {
      _viewMode = mode;
      if (mode == PlanningViewMode.day && _daysReady) {
        _days = _buildPickerDays();
      }
    });
    if (mode == PlanningViewMode.day) _scrollPickerToSelectedDay();
  }

  /// Passe à la semaine / au mois précédent ([delta] = -1) ou suivant (+1).
  void _shiftPeriod(int delta) {
    setState(() {
      _selectedDay = shiftPlanningAnchor(_viewMode, _selectedDay, delta);
    });
  }

  /// Relance le stream du planning affiché (jour ou période).
  void _invalidateEvents({required bool canManage}) {
    final mode = _effectiveViewMode(canManage: canManage);
    final dayParams = (clubId: widget.clubId, day: _selectedDay);
    if (mode != PlanningViewMode.day) {
      ref.invalidate(clubPlanningRangeEventsProvider(_rangeParams(mode)));
    } else if (canManage) {
      ref.invalidate(clubPlanningEventsProvider(dayParams));
    } else {
      ref.invalidate(memberClubPlanningEventsProvider(dayParams));
    }
  }

  @override
  void dispose() {
    _dayScrollController.dispose();
    super.dispose();
  }

  void _selectDay(DateTime day) {
    setState(() {
      _selectedDay = day;
      _focusEventId = null;
    });
    if (_viewMode == PlanningViewMode.day) {
      scrollPlanningToDay(
        controller: _dayScrollController,
        days: _days,
        day: day,
      );
    }
  }

  /// Recharge le planning sans bloquer indéfiniment sur les StreamProviders.
  Future<void> _refreshPlanning({required bool canManage}) async {
    final clubId = widget.clubId;
    final dayParams = (clubId: clubId, day: _selectedDay);
    final mode = _effectiveViewMode(canManage: canManage);

    _invalidateEvents(canManage: canManage);
    ref.invalidate(clubTeamsProvider(clubId));

    ref.invalidate(clubProvider(clubId));
    await ref.read(clubProvider(clubId).future);

    final streamWaits = <Future<Object?>>[
      if (mode != PlanningViewMode.day)
        ref.read(clubPlanningRangeEventsProvider(_rangeParams(mode)).future)
      else if (canManage)
        ref.read(clubPlanningEventsProvider(dayParams).future)
      else
        ref.read(memberClubPlanningEventsProvider(dayParams).future),
      ref.read(clubTeamsProvider(clubId).future),
    ];

    try {
      await Future.wait(streamWaits).timeout(const Duration(seconds: 8));
    } on TimeoutException {
      // L’indicateur se ferme quand même ; les streams peuvent rattraper ensuite.
    }

    await _initDays();
  }

  void _showEventSheet(
    ClubEvent event,
    Map<String, ClubTeam> teamsById, {
    required bool canManage,
  }) {
    final members = ref.read(clubMembersProvider(widget.clubId)).value;
    PlanningEventDetailSheet.show(
      context: context,
      ref: ref,
      clubId: widget.clubId,
      event: event,
      teamLabel: PlanningEventDisplay.teamLabel(event, teamsById),
      excludeCoachUids: PlanningEventDisplay.coachUidsToExclude(
        event,
        teamsById,
        membersByUid:
            members != null ? indexClubMembersByUid(members) : null,
      ),
      canManageEvents: canManage,
      onCanceled: () {},
      onRsvpUpdated: () => _invalidateEvents(canManage: canManage),
    );
  }

  /// Met à jour le RSVP de la cible sélectionnée (soi ou enfant) sur [event],
  /// puis recharge le jour.
  Future<void> _setRsvp(
    ClubEvent event,
    RsvpStatus status, {
    required bool canManage,
  }) async {
    final rsvpTarget = await ref.read(rsvpTargetProvider(widget.clubId).future);
    if (rsvpTarget == null) return;

    final eventService = ref.read(eventServiceProvider);

    void invalidateDay() => _invalidateEvents(canManage: canManage);

    try {
      await eventService.updateRsvp(
        clubId: event.clubId,
        eventId: event.id,
        uid: rsvpTarget.audienceId,
        status: status,
        viaCallable: rsvpTarget.viaCallable,
      );
      invalidateDay();
    } catch (_) {
      invalidateDay();
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.planning.rsvpFailed);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final member = ref.watch(clubMemberProvider(clubId)).value;
    final club = ref.watch(clubProvider(clubId)).value;
    final target = ref.watch(selectedClubAudienceProvider(clubId));
    final isChildView = target?.isChild == true;
    final canManage = !isChildView &&
        member != null &&
        (club?.coachPermissions ?? CoachPermissions.defaults).allowsCreateEvents(
          isAdmin: member.role == MemberRoles.admin,
          isCoach: member.role == MemberRoles.coach,
        );
    final viewMode = _effectiveViewMode(canManage: canManage);
    final dayParams = (clubId: clubId, day: _selectedDay);
    final eventsAsync = switch (viewMode) {
      PlanningViewMode.day => canManage
          ? ref.watch(clubPlanningEventsProvider(dayParams))
          : ref.watch(memberClubPlanningEventsProvider(dayParams)),
      _ => ref.watch(clubPlanningRangeEventsProvider(_rangeParams(viewMode))),
    };
    final teamsAsync = ref.watch(clubTeamsProvider(clubId));
    final clubMembers = member != null
        ? ref.watch(clubMembersProvider(clubId)).value
        : null;
    final membersByUid =
        clubMembers != null ? indexClubMembersByUid(clubMembers) : null;
    final rsvpTarget = ref.watch(rsvpTargetProvider(clubId)).asData?.value;
    final rsvpMember = rsvpTarget?.member;
    final audienceKeys =
        rsvpMember != null ? eventAudienceKeys(rsvpMember) : null;

    final clubBrandColors = club != null
        ? resolveClubBrandColors(
            brandColorHex: club.brandColorHex,
            clubId: clubId,
          )
        : null;
    final clubColor = clubBrandColors?.primary;
    final clubColorSecondary = clubBrandColors?.secondary;

    final teamsById = teamsAsync.value?.fold<Map<String, ClubTeam>>(
          {},
          (map, t) => map..[t.id] = t,
        ) ??
        {};

    final memberAccent = ref.watch(clubMemberAccentProvider(clubId));

    Widget buildEventTile(ClubEvent event) {
      final canRsvp = rsvpTarget != null &&
          PlanningEventDisplay.canRsvpOnEvent(
            event,
            rsvpTarget.subjectId,
            teamsById,
            clubAudienceId: rsvpTarget.audienceId,
            member: rsvpMember,
            membersByUid: membersByUid,
          );
      final tile = PlanningEventTile(
        event: event,
        teamLabel: PlanningEventDisplay.teamLabel(event, teamsById),
        teamRsvpCounts: PlanningEventDisplay.rsvpCountsIncludingCoaches(
          event,
          teamsById,
          membersByUid: membersByUid,
        ),
        clubColor: clubColor,
        clubColorSecondary: clubColorSecondary,
        onTap: () => _showEventSheet(event, teamsById, canManage: canManage),
        rsvpStatus: canRsvp
            ? event.rsvpStatusForUser(
                rsvpTarget.subjectId,
                clubAudienceId: rsvpTarget.audienceId,
                memberAudienceKeys: audienceKeys,
              )
            : null,
        onRsvpSelected: canRsvp
            ? (next) => _setRsvp(event, next, canManage: canManage)
            : null,
      );
      if (event.id != _focusEventId) return tile;
      return PlanningFocusedEventHighlight(
        color: clubColor ?? ViroColors.primary600,
        child: tile,
      );
    }

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
      fallbackRoute: AppRoutes.clubDetailPath(clubId),
      appBar: ViroAppBar(
        fallbackRoute: AppRoutes.clubDetailPath(clubId),
        title: Text(AppCopy.planning.clubScreenTitle),
        actions: [
          IconButton(
            icon: ViroIcon(ViroIcons.calendarPlus),
            tooltip: AppCopy.planning.addToCalendarTooltip,
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
                label: AppCopy.planning.goToTodayTooltip,
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
              semanticLabel: AppCopy.planning.addEventTooltip,
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
          const SizedBox(height: ViroSpacing.sm),
          if (canManage) ...[
            PlanningViewModeSwitcher(
              mode: viewMode,
              onChanged: _setViewMode,
            ),
            const SizedBox(height: ViroSpacing.sm),
          ],
          if (viewMode != PlanningViewMode.day)
            _buildPeriodHeader(viewMode)
          else if (!_daysReady)
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
              selectedDayColor: clubColor,
            ),
          const Divider(height: 1, color: ViroColors.gray200),
          Expanded(
            child: ViroRefreshIndicator(
              onRefresh: () => _refreshPlanning(canManage: canManage),
              child: switch (viewMode) {
                PlanningViewMode.month => _buildMonthView(
                    eventsAsync: eventsAsync,
                    buildEventTile: buildEventTile,
                    accentColor: clubColor,
                  ),
                PlanningViewMode.week => eventsAsync.when(
                    loading: _buildLoadingList,
                    error: (error, stackTrace) => _buildErrorList(),
                    data: (events) => PlanningWeekAgenda(
                      weekStart: planningStartOfWeek(_selectedDay),
                      events: events,
                      eventTileBuilder: buildEventTile,
                      physics: ViroRefreshIndicator.scrollPhysics,
                      accentColor: clubColor,
                    ),
                  ),
                PlanningViewMode.day => eventsAsync.when(
                    loading: _buildLoadingList,
                    error: (error, stackTrace) => _buildErrorList(),
                    data: (events) => events.isEmpty
                        ? _buildMessageList(
                            canManage
                                ? AppCopy.planning.emptyDayAdmin
                                : AppCopy.planning.emptyDay,
                          )
                        : ListView.separated(
                            physics: ViroRefreshIndicator.scrollPhysics,
                            padding: const EdgeInsets.fromLTRB(
                              ViroSpacing.screenHorizontal,
                              ViroSpacing.md,
                              ViroSpacing.screenHorizontal,
                              ViroSpacing.xl,
                            ),
                            itemCount: events.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: ViroSpacing.sm),
                            itemBuilder: (_, index) =>
                                buildEventTile(events[index]),
                          ),
                  ),
              },
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildPeriodHeader(PlanningViewMode mode) {
    final isWeek = mode == PlanningViewMode.week;
    return PlanningPeriodHeader(
      label: isWeek
          ? formatPlanningWeekRange(planningStartOfWeek(_selectedDay))
          : formatPlanningMonth(_selectedDay),
      previousTooltip: isWeek
          ? AppCopy.planning.previousWeekTooltip
          : AppCopy.planning.previousMonthTooltip,
      nextTooltip: isWeek
          ? AppCopy.planning.nextWeekTooltip
          : AppCopy.planning.nextMonthTooltip,
      onPrevious: () => _shiftPeriod(-1),
      onNext: () => _shiftPeriod(1),
    );
  }

  /// Vue mois : grille (pastilles dès que la période est chargée), légende,
  /// puis les événements du jour sélectionné.
  Widget _buildMonthView({
    required AsyncValue<List<ClubEvent>> eventsAsync,
    required Widget Function(ClubEvent event) buildEventTile,
    Color? accentColor,
  }) {
    final eventsByDay =
        groupPlanningEventsByDay(eventsAsync.value ?? const []);
    final dayEvents = eventsByDay[planningDateOnly(_selectedDay)] ?? const [];

    final Widget dayContent;
    if (!eventsAsync.hasValue && eventsAsync.hasError) {
      dayContent = const SizedBox(height: 160, child: ViroErrorState());
    } else if (!eventsAsync.hasValue) {
      dayContent = const Padding(
        padding: EdgeInsets.all(ViroSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      );
    } else if (dayEvents.isEmpty) {
      dayContent = Text(
        AppCopy.planning.emptyDayAdmin,
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(color: ViroColors.gray600),
      );
    } else {
      dayContent = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final event in dayEvents)
            Padding(
              padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
              child: buildEventTile(event),
            ),
        ],
      );
    }

    return ListView(
      physics: ViroRefreshIndicator.scrollPhysics,
      padding: const EdgeInsets.only(
        top: ViroSpacing.sm,
        bottom: ViroSpacing.xl,
      ),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.sm,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: ViroColors.white,
              borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: ViroSpacing.sm),
              child: PlanningMonthGrid(
                month: _selectedDay,
                selectedDay: _selectedDay,
                eventsByDay: eventsByDay,
                onDaySelected: _selectDay,
                accentColor: accentColor,
              ),
            ),
          ),
        ),
        const SizedBox(height: ViroSpacing.lg),
        const PlanningEventTypeLegend(),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.screenHorizontal,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PlanningDaySectionHeader(
                day: _selectedDay,
                accentColor: accentColor,
              ),
              dayContent,
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingList() => ListView(
        physics: ViroRefreshIndicator.scrollPhysics,
        children: const [
          SizedBox(
            height: 240,
            child: Center(child: CircularProgressIndicator()),
          ),
        ],
      );

  Widget _buildErrorList() => ListView(
        physics: ViroRefreshIndicator.scrollPhysics,
        children: const [
          SizedBox(height: 240, child: ViroErrorState()),
        ],
      );

  Widget _buildMessageList(String message) => ListView(
        physics: ViroRefreshIndicator.scrollPhysics,
        padding: const EdgeInsets.all(ViroSpacing.xl),
        children: [
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.35,
            child: Center(
              child: Text(
                message,
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
