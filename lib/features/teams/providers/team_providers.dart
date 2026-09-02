import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

final myTeamsProvider =
    StreamProvider.family<List<ClubTeam>, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);

  // Parent : équipes de l'enfant, lues une par une (pas de `where` roster).
  if (ref.watch(isGuardianOnlyInClubProvider(clubId))) {
    return _watchGuardianChildTeams(ref, clubId);
  }

  final member = ref.watch(clubMemberProvider(clubId)).value;
  final audienceId = member?.memberId ?? auth.uid;

  return ref.read(teamServiceProvider).watchUserTeams(
        clubId: clubId,
        uid: audienceId,
        alternateUid: auth.uid,
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
  ).asyncExpand(
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
