import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
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

/// Planning club sur une période (vues semaine / mois coach-admin).
///
/// [start] et [endExclusive] doivent être des minuits locaux stables
/// (bornes de semaine / grille de mois) pour que la famille soit réutilisée.
final clubPlanningRangeEventsProvider = StreamProvider.family<List<ClubEvent>,
    ({String clubId, DateTime start, DateTime endExclusive})>(
  (ref, params) {
    final auth = ref.watch(firestoreAuthReadyProvider).value;
    if (auth == null) return Stream.value([]);
    return ref.read(eventServiceProvider).watchClubEventsInRange(
          clubId: params.clubId,
          start: params.start,
          endExclusive: params.endExclusive,
        );
  },
);

/// Joueurs d'une équipe, triés (création de match : choix des convoqués).
///
/// `null` tant que l'équipe ou les membres chargent.
final teamConvocationPlayersProvider = Provider.family<
    List<({String id, ClubMember member})>?,
    ({String clubId, String teamId})>((ref, params) {
  final teams = ref.watch(clubTeamsProvider(params.clubId)).value;
  final members = ref.watch(clubMembersProvider(params.clubId)).value;
  if (teams == null || members == null) return null;
  return teamPlayerEntries(
    teams.where((team) => team.id == params.teamId).toList(),
    indexClubMembersByUid(members),
  );
});

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
    final eventService = ref.read(eventServiceProvider);
    // Parent sans fiche : uniquement les événements des équipes de l'enfant.
    final childEvents = ref.watch(isGuardianOnlyInClubProvider(params.clubId))
        ? Stream.fromFuture(
            ref.watch(clubAudienceMemberProvider(params.clubId).future),
          ).asyncExpand(
            (child) => eventService.watchUpcomingEventsForGuardian(
              clubId: params.clubId,
              childTeamIds: child?.teamIds ?? const [],
              childAudienceKeys:
                  child != null ? eventAudienceKeys(child) : const {},
            ),
          )
        : eventService.watchEventsForTargetMember(
            clubId: params.clubId,
            memberId: audienceId,
          );
    return childEvents.map(
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
