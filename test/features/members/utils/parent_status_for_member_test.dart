import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/members/utils/parent_status_for_member.dart';
import 'package:viro_team_v2/services/member_service.dart';

void main() {
  group('buildParentStatusByMemberId', () {
    test('mappe pending et active par memberId', () {
      final map = buildParentStatusByMemberId([
        ClubParentEntry(
          rowKey: 'p1',
          displayName: 'Marie Dupont',
          status: GuardianStatuses.pending,
          children: [
            ClubParentChildRef(
              memberId: 'm1',
              displayName: 'Lucas',
              status: GuardianStatuses.pending,
            ),
          ],
        ),
        ClubParentEntry(
          rowKey: 'p2',
          displayName: 'Paul Martin',
          status: GuardianStatuses.active,
          children: [
            ClubParentChildRef(
              memberId: 'm2',
              displayName: 'Emma',
              status: GuardianStatuses.active,
            ),
          ],
        ),
      ]);

      expect(map['m1'], ParentLinkStatus.pending);
      expect(map['m2'], ParentLinkStatus.active);
      expect(map.containsKey('m3'), isFalse);
    });

    test('active prime sur pending pour le même enfant', () {
      final map = buildParentStatusByMemberId([
        ClubParentEntry(
          rowKey: 'a',
          displayName: 'Parent A',
          status: GuardianStatuses.pending,
          children: [
            ClubParentChildRef(
              memberId: 'm1',
              displayName: 'Lucas',
              status: GuardianStatuses.pending,
            ),
          ],
        ),
        ClubParentEntry(
          rowKey: 'b',
          displayName: 'Parent B',
          status: GuardianStatuses.active,
          children: [
            ClubParentChildRef(
              memberId: 'm1',
              displayName: 'Lucas',
              status: GuardianStatuses.active,
            ),
          ],
        ),
      ]);

      expect(map['m1'], ParentLinkStatus.active);
    });
  });
}
