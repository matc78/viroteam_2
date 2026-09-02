import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/guardian_service.dart';

/// `true` si l'utilisateur connecté n'est que parent dans [clubId]
/// (lien actif, pas de fiche membre) : lectures limitées aux équipes enfant.
final isGuardianOnlyInClubProvider =
    Provider.family<bool, String>((ref, clubId) {
  final user = ref.watch(viroUserProvider).value;
  return user?.isGuardianOnlyInClub(clubId) ?? false;
});

/// Équipes de tous les enfants suivis dans [clubId] (union des
/// `members/{child}.teamIds`). Seules requêtes autorisées à un parent :
/// `teams/{id}`, `events where teamIds array-contains id`, annonces équipe.
final guardianChildTeamIdsProvider =
    FutureProvider.family<List<String>, String>((ref, clubId) async {
  final user = ref.watch(viroUserProvider).value;
  if (user == null) return const [];
  return loadGuardianChildTeamIds(
    guardianService: ref.read(guardianServiceProvider),
    user: user,
    clubId: clubId,
  );
});

/// Union des `teamIds` des fiches enfants actives de [user] dans [clubId].
Future<List<String>> loadGuardianChildTeamIds({
  required GuardianService guardianService,
  required ViroUser user,
  required String clubId,
}) async {
  final childLinks = user.activeParentLinksInClub(clubId);
  if (childLinks.isEmpty) return const [];

  final children = await Future.wait(
    childLinks.map(
      (link) => guardianService.getClubMember(
        clubId: clubId,
        memberId: link.memberId,
      ),
    ),
  );
  return mergeChildTeamIds(children.map((child) => child?.teamIds));
}

/// Fusionne des listes de `teamIds` (fiches enfants) sans doublon ni vide.
List<String> mergeChildTeamIds(Iterable<List<String>?> teamIdLists) {
  final merged = <String>{};
  for (final teamIds in teamIdLists) {
    if (teamIds == null) continue;
    merged.addAll(teamIds.where((id) => id.isNotEmpty));
  }
  return merged.toList();
}
