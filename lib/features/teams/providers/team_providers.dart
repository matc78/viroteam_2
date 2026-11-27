import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_team_category_tones.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/teams/utils/sort_manage_teams.dart';
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/stream_switch_map.dart';

/// Couleur de chaque catégorie d’équipe du club (libellé → teinte), la même
/// sur Mes équipes, Gestion et le portail (`clubTeamCategoryTones`).
/// Vide tant que le club n'est pas chargé (l'ordre des catégories dépend de
/// son sport : pas de couleurs provisoires qui changeraient ensuite).
final teamCategoryTonesProvider =
    Provider.family<Map<String, TeamCategoryTone>, String>((ref, clubId) {
  final club = ref.watch(clubProvider(clubId));
  if (!club.hasValue) return const {};
  final teams = ref.watch(clubTeamsProvider(clubId)).value ?? const [];
  return assignTeamCategoryTones(
    orderedTeamCategoryLabels(teams, sport: club.value?.sport),
  );
});

/// Liste Gestion groupée par catégorie (mes équipes d'abord dans chaque
/// groupe), `null` tant que le club ou ses équipes chargent.
final manageTeamCategoryGroupsProvider =
    Provider.family<List<TeamCategoryGroup>?, String>((ref, clubId) {
  final club = ref.watch(clubProvider(clubId)).value;
  final teams = ref.watch(clubTeamsProvider(clubId)).value;
  if (club == null || teams == null) return null;
  final memberId = ref.watch(clubMemberProvider(clubId)).value?.memberId;
  final ordered = memberId == null ? teams : sortManageTeams(teams, memberId);
  return buildTeamCategoryGroups(ordered, sport: club.sport);
});

final myTeamsProvider =
    StreamProvider.family<List<ClubTeam>, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);

  // Parent : équipes de l'enfant, lues une par une (pas de `where` roster).
  if (ref.watch(isGuardianOnlyInClubProvider(clubId))) {
    return _watchGuardianChildTeams(ref, clubId);
  }

  return ref.read(teamServiceProvider).watchUserTeams(
        clubId: clubId,
        uid: auth.uid,
      );
});

final clubTeamsProvider =
    StreamProvider.family<List<ClubTeam>, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);
  // Parent : `list` sur teams refusé → équipes de l'enfant par id.
  if (ref.watch(isGuardianOnlyInClubProvider(clubId))) {
    return _watchGuardianChildTeams(ref, clubId);
  }
  return ref.read(teamServiceProvider).watchClubTeams(clubId: clubId);
});

/// Équipes des enfants du parent connecté (`get` individuel par teamId).
Stream<List<ClubTeam>> _watchGuardianChildTeams(Ref ref, String clubId) {
  return Stream.fromFuture(
    ref.watch(guardianChildTeamIdsProvider(clubId).future),
  ).switchMap(
    (childTeamIds) => ref.read(teamServiceProvider).watchTeamsByIds(
          clubId: clubId,
          teamIds: childTeamIds,
        ),
  );
}

final pendingTeamMembersProvider =
    StreamProvider.family<List<PendingTeamMember>, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);
  return ref.read(teamServiceProvider).watchPendingMembers(clubId);
});
