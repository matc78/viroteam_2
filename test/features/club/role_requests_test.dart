import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/role_requests_providers.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/join_request.dart';

JoinRequest _request(String id, String userId, String role) => JoinRequest(
      id: id,
      userId: userId,
      clubId: 'club',
      roleRequested: role,
      status: JoinRequestStatus.pending,
    );

/// Fiche liée : id du document = uid Auth (clé unique).
ClubMember _member(String uid, String role) => ClubMember(
      memberId: uid,
      role: role,
      status: 'active',
      accountUid: uid,
    );

void main() {
  test('garde la demande d’un membre dont le rôle diffère', () {
    final result = actionableRoleRequests(
      [_request('r1', 'u1', MemberRoles.coach)],
      [_member('u1', MemberRoles.player)],
    );
    expect(result.single.member.memberId, 'u1');
  });

  test('masque les demandes pas encore traitables ou sans objet', () {
    final result = actionableRoleRequests(
      [
        _request('pasMembre', 'u9', MemberRoles.coach),
        _request('dejaCoach', 'u2', MemberRoles.coach),
        _request('admin', 'u3', MemberRoles.player),
      ],
      [
        _member('u2', MemberRoles.coach),
        _member('u3', MemberRoles.admin),
      ],
    );
    expect(result, isEmpty);
  });
}
