import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/event_service.dart';

class MemberEventsState {
  const MemberEventsState({
    required this.pending,
    required this.upcoming,
  });

  final List<ClubEvent> pending;
  final List<ClubEvent> upcoming;

  static const empty = MemberEventsState(pending: [], upcoming: []);
}

/// Planning global du membre — tous les clubs, temps réel.
final memberEventsProvider = StreamProvider<MemberEventsState>((ref) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  final user = ref.watch(viroUserProvider).value;

  if (auth == null || user == null || !user.hasClubs) {
    return Stream.value(MemberEventsState.empty);
  }

  final clubIds = user.clubMemberships.map((m) => m.clubId).toList();
  final authUid = auth.uid;
  final eventService = ref.read(eventServiceProvider);

  return eventService
      .watchUpcomingEventsForUser(clubIds: clubIds, authUid: authUid)
      .map((events) => categorizeMemberEvents(events, memberId: authUid));
});

/// Répartit [events] entre « à répondre » (sans RSVP de [memberId]) et « à
/// venir » ; [memberId] = id de la fiche (soi : authUid, ou enfant).
MemberEventsState categorizeMemberEvents(
  List<ClubEvent> events, {
  required String memberId,
}) {
  final pending = <ClubEvent>[];
  final upcoming = <ClubEvent>[];

  for (final event in events) {
    if (!EventService.isWithinUpcomingPlanningWindow(event.date)) continue;

    upcoming.add(event);

    final needsRsvp = event.rsvpStatusForUser(memberId) == RsvpStatus.none;

    if (needsRsvp) pending.add(event);
  }

  return MemberEventsState(
    pending: EventService.sortedByDate(pending),
    upcoming: EventService.sortedByDate(upcoming),
  );
}

/// Nombre d'events sans réponse par club (badges barre clubs).
final pendingCountByClubProvider = Provider<Map<String, int>>((ref) {
  final events = ref.watch(memberEventsProvider).value;
  final auth = ref.watch(authStateProvider).value;
  if (events == null || auth == null) return {};

  final counts = <String, int>{};
  for (final event in events.pending) {
    counts[event.clubId] = (counts[event.clubId] ?? 0) + 1;
  }
  return counts;
});
