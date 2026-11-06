import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';

void main() {
  group('ClubTeam roster (clé unique = id de la fiche)', () {
    const linked = ClubMember(
      memberId: 'uid-a',
      accountUid: 'uid-a',
      role: MemberRoles.coach,
      status: 'active',
    );
    const preRostered = ClubMember(
      memberId: 'm-pending',
      role: MemberRoles.player,
      status: 'active',
    );
    const team = ClubTeam(
      id: 't1',
      clubId: 'c1',
      name: 'U13',
      playerIds: ['m-pending'],
      coachIds: ['uid-a'],
    );

    test('reconnaît joueurs et coachs par id de fiche', () {
      expect(team.isOnCoachRoster(linked), isTrue);
      expect(team.isOnPlayerRoster(linked), isFalse);
      expect(team.isOnPlayerRoster(preRostered), isTrue);
      expect(team.isOnCoachRoster(preRostered), isFalse);
    });

    test('seul l’id de la fiche compte (plus d’alias accountUid)', () {
      const other = ClubMember(
        memberId: 'm-x',
        accountUid: 'uid-a',
        role: MemberRoles.coach,
        status: 'active',
      );
      expect(team.isOnCoachRoster(other), isFalse);
    });
  });

  group('indexClubMembersById', () {
    test('une entrée par fiche, clé = memberId', () {
      const a = ClubMember(
        memberId: 'uid-a',
        accountUid: 'uid-a',
        role: MemberRoles.player,
        status: 'active',
      );
      const b = ClubMember(
        memberId: 'm-b',
        role: MemberRoles.player,
        status: 'active',
      );
      final index = indexClubMembersById(const [a, b]);
      expect(index.keys, unorderedEquals(['uid-a', 'm-b']));
      expect(index['uid-a'], same(a));
    });
  });

  test('copyWith conserve les annonces masquées', () {
    const member = ClubMember(
      memberId: 'uid-a',
      role: 'player',
      status: 'active',
      dismissedAnnouncementIds: ['ann-1'],
    );
    expect(
      member.copyWith(displayName: 'Louka COCQ').dismissedAnnouncementIds,
      ['ann-1'],
    );
  });
}
