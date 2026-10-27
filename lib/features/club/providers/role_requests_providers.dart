import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/join_request.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Demande de rôle prête à être traitée, avec la fiche du demandeur.
class ActionableRoleRequest {
  const ActionableRoleRequest({required this.request, required this.member});

  final JoinRequest request;
  final ClubMember member;
}

/// Ne garde que les demandes qu'un admin peut régler tout de suite : le
/// demandeur a déjà rejoint le club, son rôle diffère du rôle demandé et il
/// n'est pas admin (pas de rétrogradation par ce biais). Les autres
/// réapparaîtront d'elles-mêmes quand elles deviendront traitables.
List<ActionableRoleRequest> actionableRoleRequests(
  List<JoinRequest> requests,
  List<ClubMember> members,
) {
  final result = <ActionableRoleRequest>[];
  for (final request in requests) {
    if (!request.isPending || request.userId.isEmpty) continue;
    final member = members.where(
      (m) => m.accountUid == request.userId || m.memberId == request.userId,
    ).firstOrNull;
    if (member == null) continue;
    if (member.role == request.roleRequested) continue;
    if (MemberRoleHierarchy.isAdmin(member.role)) continue;
    result.add(ActionableRoleRequest(request: request, member: member));
  }
  return result;
}

/// Demandes en attente du club, lues seulement par un admin (règles).
final pendingRoleRequestsProvider =
    StreamProvider.family<List<JoinRequest>, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  final member = ref.watch(clubMemberProvider(clubId)).value;
  if (auth == null || member == null || member.role != MemberRoles.admin) {
    return Stream.value(const []);
  }
  return ref.read(joinRequestServiceProvider).watchPendingClubRequests(clubId);
});

/// Demandes traitables du club (voir [actionableRoleRequests]).
final actionableRoleRequestsProvider = Provider.family<
    AsyncValue<List<ActionableRoleRequest>>, String>((ref, clubId) {
  final requestsAsync = ref.watch(pendingRoleRequestsProvider(clubId));
  return requestsAsync.whenData((requests) {
    if (requests.isEmpty) return const <ActionableRoleRequest>[];
    final members = ref.watch(clubMembersProvider(clubId)).value;
    if (members == null) return const <ActionableRoleRequest>[];
    return actionableRoleRequests(requests, members);
  });
});
