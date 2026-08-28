import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

class ClubEventsState {
  const ClubEventsState({
    required this.pending,
    required this.upcoming,
  });

  final List<ClubEvent> pending;
  final List<ClubEvent> upcoming;

  static const empty = ClubEventsState(pending: [], upcoming: []);
}

final clubProvider = FutureProvider.family<Club?, String>((ref, clubId) {
  return ref.read(clubServiceProvider).getClub(clubId);
});

final clubMemberProvider =
    StreamProvider.family<ClubMember?, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value(null);
  return ref.read(eventServiceProvider).watchClubMember(
        clubId: clubId,
        uid: auth.uid,
      );
});

/// Events du club — dérivé du planning global ([memberEventsProvider]).
final clubEventsProvider =
    Provider.family<AsyncValue<ClubEventsState>, String>((ref, clubId) {
  return ref.watch(memberEventsProvider).when(
        data: (state) => AsyncValue.data(
          ClubEventsState(
            pending: state.pending.where((e) => e.clubId == clubId).toList(),
            upcoming: state.upcoming.where((e) => e.clubId == clubId).toList(),
          ),
        ),
        loading: () => const AsyncValue.loading(),
        error: (e, st) => AsyncValue.error(e, st),
      );
});

final clubAttendanceRateProvider =
    FutureProvider.family<double?, String>((ref, clubId) async {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return null;
  return ref.read(eventServiceProvider).computeAttendanceRate(
        clubId: clubId,
        authUid: auth.uid,
      );
});

/// Planning d’une fiche cible (enfant) — pas de fusion avec le calendrier sénior.
final clubEventsForMemberProvider = StreamProvider.family<ClubEventsState,
    ({String clubId, String memberId})>((ref, params) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value(ClubEventsState.empty);
  final eventService = ref.read(eventServiceProvider);
  return eventService
      .watchEventsForTargetMember(
        clubId: params.clubId,
        memberId: params.memberId,
      )
      .map(
        (events) => categorizeMemberEvents(
          events,
          authUid: params.memberId,
          audienceByClub: {params.clubId: params.memberId},
        ),
      )
      .map(
        (state) => ClubEventsState(
          pending: state.pending,
          upcoming: state.upcoming,
        ),
      );
});
