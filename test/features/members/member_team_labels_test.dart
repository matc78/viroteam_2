import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/utils/member_team_labels.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/models/club_team.dart';

void main() {
  ClubMember member({
    List<String> coachTeamIds = const [],
    List<String> teamIds = const [],
    Set<ClubPermission> permissions = const {},
  }) => ClubMember(
        memberId: 'm1',
        status: 'active',
        firstName: 'Lou',
        lastName: 'Test',
        coachTeamIds: coachTeamIds,
        teamIds: teamIds,
        permissions: permissions,
      );

  ClubTeam team(String id, String name) => ClubTeam(
        id: id,
        clubId: 'c1',
        name: name,
      );

  group('resolveCoachedTeamNames', () {
    test('ne garde que les équipes de coachTeamIds, triées', () {
      expect(
        resolveCoachedTeamNames(
          member(coachTeamIds: ['t2', 't1']),
          [team('t1', 'Alpha'), team('t2', 'Beta'), team('t3', 'Gamma')],
        ),
        ['Alpha', 'Beta'],
      );
    });

    test('vide si aucune équipe entraînée', () {
      expect(
        resolveCoachedTeamNames(member(), [team('t1', 'Alpha')]),
        isEmpty,
      );
    });
  });

  group('resolveMemberTeamLabels', () {
    test('« sparring » à la place de « joueur » pour un sparring', () {
      const seniors = ClubTeam(
        id: 't1',
        clubId: 'c1',
        name: 'Seniors',
        playerIds: ['m1'],
        sparringIds: ['m1'],
      );
      const juniors = ClubTeam(
        id: 't2',
        clubId: 'c1',
        name: 'Juniors',
        playerIds: ['m1'],
      );
      expect(
        resolveMemberTeamLabels(member(), [seniors, juniors]),
        [
          'Juniors (${AppCopy.members.teamRolePlayer})',
          'Seniors (${AppCopy.members.teamRoleSparring})',
        ],
      );
    });
  });

  group('rightsSummary', () {
    test('admin prime', () {
      expect(
        AppCopy.permissions.rightsSummary(
          isAdmin: true,
          permissionCount: 1,
          isTeamCoach: true,
        ),
        AppCopy.permissions.allRights,
      );
    });

    test('entraîneur avec un droit club', () {
      expect(
        AppCopy.permissions.rightsSummary(
          isAdmin: false,
          permissionCount: 1,
          isTeamCoach: true,
        ),
        'Entraîneur · 1 droit club',
      );
    });

    test('entraîneur sans droit club', () {
      expect(
        AppCopy.permissions.rightsSummary(
          isAdmin: false,
          permissionCount: 0,
          isTeamCoach: true,
        ),
        'Entraîneur · aucun droit club',
      );
    });

    test('membre sans équipe', () {
      expect(
        AppCopy.permissions.rightsSummary(
          isAdmin: false,
          permissionCount: 2,
          isTeamCoach: false,
        ),
        '2 droits',
      );
    });
  });
}
