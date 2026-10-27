import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/event_service.dart';
import 'package:viro_team_v2/utils/stream_switch_map.dart';

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

/// Planning club sur une période (vues semaine / mois ; brut pour les
/// gestionnaires, filtré par [memberClubPlanningRangeEventsProvider] sinon).
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

/// Planning joueur / parent : événements à venir de la cible sélectionnée
/// (soi ou enfant), mêmes requêtes bornées que l'accueil.
///
/// Un seul jeu d'écoutes par club, partagé par le bandeau de jours, la vue
/// jour et la recherche du prochain événement.
final memberClubUpcomingPlanningEventsProvider =
    StreamProvider.family<List<ClubEvent>, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);

  final member = ref.watch(clubMemberProvider(clubId)).value;
  final target = ref.watch(selectedClubAudienceProvider(clubId));
  final audienceId = target?.memberId ?? member?.memberId ?? auth.uid;
  final eventService = ref.read(eventServiceProvider);

  if (target?.isChild == true) {
    // Parent sans fiche : uniquement les événements des équipes de l'enfant.
    return ref.watch(isGuardianOnlyInClubProvider(clubId))
        ? Stream.fromFuture(
            ref.watch(clubAudienceMemberProvider(clubId).future),
          ).switchMap(
            (child) => eventService.watchUpcomingEventsForGuardian(
              clubId: clubId,
              childTeamIds: child?.teamIds ?? const [],
              childAudienceKeys:
                  child != null ? eventAudienceKeys(child) : const {},
            ),
          )
        : eventService.watchEventsForTargetMember(
            clubId: clubId,
            memberId: audienceId,
          );
  }

  return eventService.watchUpcomingEventsForClubMember(
    clubId: clubId,
    audienceId: audienceId,
    authUid: auth.uid,
  );
});

/// Planning joueur : événements du jour, filtrés depuis
/// [memberClubUpcomingPlanningEventsProvider].
final memberClubPlanningEventsProvider = Provider.family<
    AsyncValue<List<ClubEvent>>,
    ({String clubId, DateTime day})>((ref, params) {
  return ref
      .watch(memberClubUpcomingPlanningEventsProvider(params.clubId))
      .whenData(
        (events) => EventService.sortedByDate(
          events.where(
            (event) => EventService.sameCalendarDay(event.date, params.day),
          ),
        ),
      );
});

/// Premier jour (minuit local) après [after] où la cible a un événement,
/// ou `null` (rien dans la fenêtre chargée, ou chargement en cours).
final memberClubNextEventDayProvider =
    Provider.family<DateTime?, ({String clubId, DateTime after})>(
        (ref, params) {
  final events =
      ref.watch(memberClubUpcomingPlanningEventsProvider(params.clubId)).value;
  if (events == null) return null;
  return nextPlanningEventDay(events, after: params.after);
});

/// Premier jour calendaire strictement après [after] portant un événement
/// de [events], ou `null`.
DateTime? nextPlanningEventDay(
  Iterable<ClubEvent> events, {
  required DateTime after,
}) {
  final afterDay = DateTime(after.year, after.month, after.day);
  DateTime? next;
  for (final event in events) {
    final day = DateTime(event.date.year, event.date.month, event.date.day);
    if (!day.isAfter(afterDay)) continue;
    if (next == null || day.isBefore(next)) next = day;
  }
  return next;
}

/// Vues semaine / mois d'un parent sans fiche : événements des équipes de
/// l'enfant sélectionné sur la période (requêtes par équipe, seules
/// lisibles par un parent selon les rules).
final guardianClubPlanningRangeEventsProvider = StreamProvider.family<
    List<ClubEvent>,
    ({String clubId, DateTime start, DateTime endExclusive})>((ref, params) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);
  final eventService = ref.read(eventServiceProvider);
  return Stream.fromFuture(
    ref.watch(clubAudienceMemberProvider(params.clubId).future),
  ).switchMap(
    (child) => eventService.watchGuardianEventsInRange(
      clubId: params.clubId,
      childTeamIds: child?.teamIds ?? const [],
      childAudienceKeys: child != null ? eventAudienceKeys(child) : const {},
      start: params.start,
      endExclusive: params.endExclusive,
    ),
  );
});

/// Vues semaine / mois en lecture seule hors gestionnaires.
///
/// Joueur (ou parent qui a aussi sa fiche) : la requête club de la période
/// (lisible par tout membre selon les rules), filtrée sur les événements qui
/// concernent la cible. Parent sans fiche : [guardianClubPlanningRangeEventsProvider].
final memberClubPlanningRangeEventsProvider = Provider.family<
    AsyncValue<List<ClubEvent>>,
    ({String clubId, DateTime start, DateTime endExclusive})>((ref, params) {
  if (ref.watch(isGuardianOnlyInClubProvider(params.clubId))) {
    return ref.watch(guardianClubPlanningRangeEventsProvider(params));
  }
  final rangeAsync = ref.watch(clubPlanningRangeEventsProvider(params));
  final targetAsync = ref.watch(rsvpTargetProvider(params.clubId));
  final teamsAsync = ref.watch(clubTeamsProvider(params.clubId));

  if (rangeAsync.hasError && !rangeAsync.hasValue) {
    return AsyncValue.error(rangeAsync.error!, rangeAsync.stackTrace!);
  }
  final events = rangeAsync.value;
  final teams = teamsAsync.value;
  if (events == null || teams == null || !targetAsync.hasValue) {
    return const AsyncValue.loading();
  }
  final target = targetAsync.value;
  if (target == null) return const AsyncValue.data([]);

  final teamsById = {for (final team in teams) team.id: team};
  final playerTeamIds = <String>{
    ...?target.member?.teamIds,
    for (final team in teams)
      if (team.playerIds.contains(target.audienceId) ||
          team.playerIds.contains(target.subjectId))
        team.id,
  };
  return AsyncValue.data([
    for (final event in events)
      if (PlanningEventDisplay.isVisibleToMember(
        event: event,
        authUid: target.subjectId,
        audienceId: target.audienceId,
        playerTeamIds: playerTeamIds,
        teamsById: teamsById,
      ))
        event,
  ]);
});
