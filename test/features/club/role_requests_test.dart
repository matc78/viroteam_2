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

ClubMember _member(String memberId, String role, {String? accountUid}) =>
    ClubMember(
      memberId: memberId,
      role: role,
      status: 'active',
      accountUid: accountUid,
    );

void main() {
  test('garde la demande d’un membre dont le rôle diffère', () {
    final result = actionableRoleRequests(
      [_request('r1', 'u1', MemberRoles.coach)],
      [_member('m1', MemberRoles.player, accountUid: 'u1')],
    );
    expect(result.single.member.memberId, 'm1');
  });

  test('retrouve aussi une fiche dont l’id est l’uid', () {
    final result = actionableRoleRequests(
      [_request('r1', 'u1', MemberRoles.coach)],
      [_member('u1', MemberRoles.player)],
    );
    expect(result, hasLength(1));
  });

  test('masque les demandes pas encore traitables ou sans objet', () {
    final result = actionableRoleRequests(
      [
        _request('pasMembre', 'u9', MemberRoles.coach),
        _request('dejaCoach', 'u2', MemberRoles.coach),
        _request('admin', 'u3', MemberRoles.player),
      ],
      [
        _member('m2', MemberRoles.coach, accountUid: 'u2'),
        _member('m3', MemberRoles.admin, accountUid: 'u3'),
      ],
    );
    expect(result, isEmpty);
  });
}
