import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/home/widgets/event_planning_card.dart';
import 'package:viro_team_v2/features/home/widgets/planning_day_section_header.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Limite d'événements affichés en aperçu sur la home membre.
const memberHomePlanningPreviewLimit = 5;

/// Liste groupée par jour des événements à venir d'un membre (multi-clubs).
class MemberUpcomingEventsList extends ConsumerWidget {
  const MemberUpcomingEventsList({
    super.key,
    required this.events,
    required this.clubNames,
    required this.clubColors,
    this.clubSecondaryColors = const {},
    required this.teamsByClub,
    required this.onShowDetail,
    required this.onSetRsvp,
    this.maxEvents,
  });

  final List<ClubEvent> events;
  final Map<String, String> clubNames;
  final Map<String, Color> clubColors;
  final Map<String, Color?> clubSecondaryColors;
  final Map<String, Map<String, ClubTeam>> teamsByClub;
  final void Function({
    required ClubEvent event,
    required Map<String, ClubTeam> teams,
    required bool canManageEvents,
  }) onShowDetail;
  final Future<void> Function(ClubEvent event, RsvpStatus status) onSetRsvp;
  final int? maxEvents;

  static DateTime _dateOnly(DateTime date) =>
      DateTime(date.year, date.month, date.day);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final displayEvents =
        maxEvents != null ? events.take(maxEvents!).toList() : events;

    final groups = <({DateTime day, List<ClubEvent> events})>[];
    for (final event in displayEvents) {
      final day = _dateOnly(event.date);
      if (groups.isEmpty || groups.last.day != day) {
        groups.add((day: day, events: [event]));
      } else {
        groups.last.events.add(event);
      }
    }

    final children = <Widget>[];
    for (var groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      final group = groups[groupIndex];
      children.add(
        PlanningDaySectionHeader(
          day: group.day,
          compactTop: groupIndex == 0,
        ),
      );
      for (final event in group.events) {
        children.add(
          _MemberEventCard(
            event: event,
            clubNames: clubNames,
            clubColors: clubColors,
            clubSecondaryColors: clubSecondaryColors,
            teamsByClub: teamsByClub,
            onShowDetail: onShowDetail,
            onSetRsvp: onSetRsvp,
          ),
        );
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}

class _MemberEventCard extends ConsumerWidget {
  const _MemberEventCard({
    required this.event,
    required this.clubNames,
    required this.clubColors,
    this.clubSecondaryColors = const {},
    required this.teamsByClub,
    required this.onShowDetail,
    required this.onSetRsvp,
  });

  final ClubEvent event;
  final Map<String, String> clubNames;
  final Map<String, Color> clubColors;
  final Map<String, Color?> clubSecondaryColors;
  final Map<String, Map<String, ClubTeam>> teamsByClub;
  final void Function({
    required ClubEvent event,
    required Map<String, ClubTeam> teams,
    required bool canManageEvents,
  }) onShowDetail;
  final Future<void> Function(ClubEvent event, RsvpStatus status) onSetRsvp;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.read(authStateProvider).value?.uid;
    final teams = teamsByClub[event.clubId] ?? {};
    final clubMembers = ref.watch(clubMembersProvider(event.clubId)).value;
    final membersByUid =
        clubMembers != null ? indexClubMembersByUid(clubMembers) : null;
    final counts = PlanningEventDisplay.rsvpCountsIncludingCoaches(
      event,
      teams,
      membersByUid: membersByUid,
    );
    final clubMember = ref.watch(clubMemberProvider(event.clubId)).value;
    final audienceId = uid != null ? (clubMember?.memberId ?? uid) : null;
    final audienceKeys =
        clubMember != null ? eventAudienceKeys(clubMember) : null;
    final canRsvp = uid != null &&
        PlanningEventDisplay.canRsvpOnEvent(
          event,
          uid,
          teams,
          clubAudienceId: audienceId,
          member: clubMember,
          membersByUid: membersByUid,
        );
    final status = uid != null
        ? event.rsvpStatusForUser(
            uid,
            clubAudienceId: audienceId,
            memberAudienceKeys: audienceKeys,
          )
        : RsvpStatus.none;
    final canManageEvents = clubMember != null &&
        MemberRoleHierarchy.isCoachOrAbove(clubMember.role);

    void openDetail() => onShowDetail(
          event: event,
          teams: teams,
          canManageEvents: canManageEvents,
        );

    return EventPlanningCard(
      event: event,
      clubName: clubNames[event.clubId] ?? AppCopy.planning.clubFallbackName,
      clubColor: clubColors[event.clubId] ?? ViroColors.primary600,
      clubColorSecondary: clubSecondaryColors[event.clubId],
      coachView: false,
      teamRsvpCounts: counts,
      onTap: openDetail,
      onLongPress: openDetail,
      rsvpStatus: canRsvp ? status : null,
      onRsvpSelected:
          canRsvp ? (next) => onSetRsvp(event, next) : null,
    );
  }
}

/// Variante sliver pour la home membre.
class MemberUpcomingEventsSliver extends ConsumerWidget {
  const MemberUpcomingEventsSliver({
    super.key,
    required this.events,
    required this.clubNames,
    required this.clubColors,
    this.clubSecondaryColors = const {},
    required this.teamsByClub,
    required this.onShowDetail,
    required this.onSetRsvp,
    this.maxEvents,
  });

  final List<ClubEvent> events;
  final Map<String, String> clubNames;
  final Map<String, Color> clubColors;
  final Map<String, Color?> clubSecondaryColors;
  final Map<String, Map<String, ClubTeam>> teamsByClub;
  final void Function({
    required ClubEvent event,
    required Map<String, ClubTeam> teams,
    required bool canManageEvents,
  }) onShowDetail;
  final Future<void> Function(ClubEvent event, RsvpStatus status) onSetRsvp;
  final int? maxEvents;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        0,
        ViroSpacing.screenHorizontal,
        ViroSpacing.xl,
      ),
      sliver: SliverToBoxAdapter(
        child: MemberUpcomingEventsList(
          events: events,
          clubNames: clubNames,
          clubColors: clubColors,
          clubSecondaryColors: clubSecondaryColors,
          teamsByClub: teamsByClub,
          onShowDetail: onShowDetail,
          onSetRsvp: onSetRsvp,
          maxEvents: maxEvents,
        ),
      ),
    );
  }
}
