import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';

void main() {
  group('pinSessionMemberIdFirst', () {
    test('remonte le membre session en tête', () {
      expect(
        pinSessionMemberIdFirst(
          ['a', 'b', 'c'],
          sessionMemberId: 'c',
        ),
        ['c', 'a', 'b'],
      );
    });

    test('ne change rien si déjà en tête ou absent', () {
      expect(
        pinSessionMemberIdFirst(
          ['a', 'b'],
          sessionMemberId: 'a',
        ),
        ['a', 'b'],
      );
      expect(
        pinSessionMemberIdFirst(
          ['a', 'b'],
          sessionMemberId: 'z',
        ),
        ['a', 'b'],
      );
      expect(
        pinSessionMemberIdFirst(['a', 'b'], sessionMemberId: null),
        ['a', 'b'],
      );
    });
  });
}
