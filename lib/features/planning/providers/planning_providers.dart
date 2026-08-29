import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/event_service.dart';

final clubPlanningEventsProvider =
    StreamProvider.family<List<ClubEvent>, ({String clubId, DateTime day})>(
  (ref, params) {
    final auth = ref.watch(firestoreAuthReadyProvider).value;
    if (auth == null) return Stream.value([]);
    return ref.read(eventServiceProvider).watchClubEventsOnDay(
          clubId: params.clubId,
          day: params.day,
        );
  },
);

/// Planning joueur : événements du jour via les mêmes requêtes que l'accueil.
final memberClubPlanningEventsProvider = StreamProvider.family<
    List<ClubEvent>,
    ({String clubId, DateTime day})>((ref, params) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);

  final member = ref.watch(clubMemberProvider(params.clubId)).value;
  final target = ref.watch(selectedClubAudienceProvider(params.clubId));
  final audienceId =
      target?.memberId ?? member?.memberId ?? auth.uid;

  if (target?.isChild == true) {
    return ref.read(eventServiceProvider).watchEventsForTargetMember(
          clubId: params.clubId,
          memberId: audienceId,
        ).map(
          (events) => EventService.sortedByDate(
            events.where(
              (event) => EventService.sameCalendarDay(event.date, params.day),
            ),
          ),
        );
  }

  return ref.read(eventServiceProvider).watchMemberEventsOnDay(
        clubId: params.clubId,
        day: params.day,
        audienceId: audienceId,
        authUid: auth.uid,
      );
});
