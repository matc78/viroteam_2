import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';

void main() {
  group('ClubTeam roster (clé unique = id de la fiche)', () {
    const linked = ClubMember(
      memberId: 'uid-a',
      accountUid: 'uid-a',
      status: 'active',
    );
    const preRostered = ClubMember(
      memberId: 'm-pending',
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
        status: 'active',
      );
      const b = ClubMember(
        memberId: 'm-b',
        status: 'active',
      );
      final index = indexClubMembersById(const [a, b]);
      expect(index.keys, unorderedEquals(['uid-a', 'm-b']));
      expect(index['uid-a'], same(a));
    });
  });

  group('droits et badges', () {
    test('lit permissions et coachTeamIds, ignore les droits inconnus', () {
      const member = ClubMember(
        memberId: 'uid-a',
        status: 'active',
        permissions: {ClubPermission.manageFees, ClubPermission.viewFees},
        coachTeamIds: ['t1'],
        teamIds: ['t1', 't2'],
      );
      expect(member.isAdmin, isFalse);
      expect(member.badges, [MemberBadge.coach, MemberBadge.player]);
      expect(member.primaryBadge, MemberBadge.coach);
      expect(member.chatBadgeId, 'coach');
    });

    test('sans droit admin ni équipe : badge Membre', () {
      const member = ClubMember(memberId: 'm', status: 'active');
      expect(member.badges, [MemberBadge.member]);
      expect(member.primaryBadge, MemberBadge.member);
      expect(member.chatBadgeId, ChatBadgeIds.member);
    });

    test('un droit autre qu\'admin ne donne pas de badge', () {
      const member = ClubMember(
        memberId: 'm',
        status: 'active',
        permissions: {ClubPermission.manageEvents},
      );
      expect(member.primaryBadge, MemberBadge.member);
    });

    test('admin prime sur entraîneur et joueur', () {
      const member = ClubMember(
        memberId: 'a',
        status: 'active',
        permissions: {ClubPermission.admin},
        coachTeamIds: ['t1'],
        teamIds: ['t1', 't2'],
      );
      expect(member.primaryBadge, MemberBadge.admin);
      expect(member.chatBadgeId, 'admin');
    });

    test('un profil de conversation garde son badge dénormalisé', () {
      const member = ClubMember(
        memberId: 'p',
        status: 'active',
        profileBadgeId: ChatBadgeIds.parent,
      );
      expect(member.chatBadgeId, ChatBadgeIds.parent);
    });

    test('encadrement : badge Admin ou Entraîneur seulement', () {
      const admin = ClubMember(
        memberId: 'a',
        status: 'active',
        permissions: {ClubPermission.admin},
      );
      const coach = ClubMember(
        memberId: 'c',
        status: 'active',
        coachTeamIds: ['t1'],
        teamIds: ['t1'],
      );
      const player = ClubMember(
        memberId: 'p',
        status: 'active',
        teamIds: ['t1'],
      );
      const treasurer = ClubMember(
        memberId: 't',
        status: 'active',
        permissions: {ClubPermission.manageFees, ClubPermission.viewFees},
      );
      expect(admin.hasStaffBadge, isTrue);
      expect(coach.hasStaffBadge, isTrue);
      expect(player.hasStaffBadge, isFalse);
      // Un droit à la carte ne fait pas un badge d'encadrement.
      expect(treasurer.hasStaffBadge, isFalse);
      expect(treasurer.permissionCount, 2);
    });
  });

  test('copyWith conserve le badge dénormalisé', () {
    const member = ClubMember(
      memberId: 'p',
      status: 'active',
      profileBadgeId: ChatBadgeIds.parent,
    );
    expect(
      member.copyWith(firstName: 'Léa').chatBadgeId,
      ChatBadgeIds.parent,
    );
  });

  test('copyWith conserve les annonces masquées', () {
    const member = ClubMember(
      memberId: 'uid-a',
      status: 'active',
      dismissedAnnouncementIds: ['ann-1'],
    );
    expect(
      member.copyWith(displayName: 'Louka COCQ').dismissedAnnouncementIds,
      ['ann-1'],
    );
  });
}
