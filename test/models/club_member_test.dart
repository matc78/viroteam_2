import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_member.dart';

void main() {
  group('ClubMember.isAccountOf', () {
    test('reconnaît le compte via accountUid', () {
      const member = ClubMember(
        memberId: 'm-a',
        accountUid: 'uid-a',
        role: MemberRoles.admin,
        status: 'active',
      );
      expect(member.isAccountOf('uid-a'), isTrue);
      expect(member.isAccountOf('uid-b'), isFalse);
    });

    test('reconnaît le compte legacy via memberId', () {
      const member = ClubMember(
        memberId: 'uid-a',
        role: MemberRoles.player,
        status: 'active',
      );
      expect(member.isAccountOf('uid-a'), isTrue);
    });

    test('uid absent ou vide ⇒ jamais sa fiche', () {
      const pending = ClubMember(
        memberId: 'm-pending',
        role: MemberRoles.player,
        status: 'active',
      );
      expect(pending.isAccountOf(null), isFalse);
      expect(pending.isAccountOf(''), isFalse);
    });
  });
}
