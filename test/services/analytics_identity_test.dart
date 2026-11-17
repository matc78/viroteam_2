import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/parent_link.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/analytics_identity.dart';
import 'package:viro_team_v2/models/club_permission.dart';

ViroUser _user({
  List<String> memberClubIds = const [],
  List<ParentLink> parentLinks = const [],
  List<String> parentClubIds = const [],
}) {
  return ViroUser(
    uid: 'u1',
    email: 'coach@example.com',
    emailNorm: 'coach@example.com',
    firstName: 'Alex',
    lastName: 'Martin',
    displayName: 'Alex Martin',
    phone: '0600000000',
    memberClubIds: memberClubIds,
    parentLinks: parentLinks,
    parentClubIds: parentClubIds,
  );
}

void main() {
  group('analyticsPersonProperties', () {
    test('retient le rôle le plus élevé et compte les clubs distincts', () {
      final properties = analyticsPersonProperties(
        _user(
          memberClubIds: const [
            'c1',
            'c2',
            'c3',
          ],
          parentLinks: const [
            ParentLink(
              clubId: 'c4',
              memberId: 'm1',
              relation: 'parent',
              status: 'active',
            ),
          ],
          parentClubIds: const ['c1', 'c4'],
        ),
      );

      expect(properties, {
        'is_parent': true,
        'club_count': 4,
      });
    });

    test('compte sans club ni lien parent', () {
      expect(analyticsPersonProperties(_user()), {
        'is_parent': false,
        'club_count': 0,
      });
    });

    test('n’expose aucune donnée personnelle', () {
      final serialized = analyticsPersonProperties(_user()).toString();

      expect(serialized, isNot(contains('example.com')));
      expect(serialized, isNot(contains('Martin')));
      expect(serialized, isNot(contains('0600000000')));
    });
  });

  test('analyticsClubProperties garde nom, sport et effectif', () {
    const club = Club(id: 'c1', name: 'US Viro', sport: 'volley', memberCount: 42);

    expect(analyticsClubProperties(club), {
      'name': 'US Viro',
      'sport': 'volley',
      'member_count': 42,
    });
  });

  group('analyticsActiveRole', () {
    test('badge de la fiche du club actif, member sans badge, none sans fiche', () {
      expect(
        analyticsActiveRole(hasMemberDoc: true, badge: MemberBadge.coach),
        'coach',
      );
      expect(analyticsActiveRole(hasMemberDoc: true), 'member');
      expect(analyticsActiveRole(hasMemberDoc: false), analyticsNoRole);
      expect(analyticsActiveRoleKey, 'active_role');
    });
  });
}
