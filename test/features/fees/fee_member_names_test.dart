import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_member_names.dart';
import 'package:viro_team_v2/models/club_member.dart';

MemberFee _fee(String memberId, String name) => MemberFee(
      memberId: memberId,
      memberDisplayName: name,
      status: MemberFeeStatus.aPayer,
      createdAt: DateTime(2026, 9, 1),
      updatedAt: DateTime(2026, 9, 1),
    );

void main() {
  test('nom courant de la fiche, sinon nom figé sur la cotisation', () {
    const renamed = ClubMember(
      memberId: 'uid-a',
      accountUid: 'uid-a',
      role: MemberRoles.player,
      status: 'active',
      firstName: 'Léa',
      lastName: 'Martin',
    );
    const unnamed = ClubMember(
      memberId: 'm-b',
      role: MemberRoles.player,
      status: 'active',
    );

    final fees = withCurrentMemberNames(
      [
        _fee('uid-a', 'Léa Durand'),
        _fee('m-b', 'Hugo Petit'),
        _fee('m-gone', 'Ancien Membre'),
      ],
      const [renamed, unnamed],
    );

    expect(fees.map((fee) => fee.memberDisplayName).toList(), [
      'Léa Martin',
      'Hugo Petit',
      'Ancien Membre',
    ]);
    expect(fees.first.memberId, 'uid-a');
    expect(fees.first.status, MemberFeeStatus.aPayer);
  });
}
