import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/models/parent_link.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/analytics_identity.dart';

ViroUser _user({
  List<ClubMembershipSummary> clubMemberships = const [],
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
    clubMemberships: clubMemberships,
    parentLinks: parentLinks,
    parentClubIds: parentClubIds,
  );
}

void main() {
  group('analyticsPersonProperties', () {
    test('retient le rôle le plus élevé et compte les clubs distincts', () {
      final properties = analyticsPersonProperties(
        _user(
          clubMemberships: const [
            ClubMembershipSummary(clubId: 'c1', role: 'player'),
            ClubMembershipSummary(clubId: 'c2', role: 'admin'),
            ClubMembershipSummary(clubId: 'c3', role: 'coach'),
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
        'max_role': 'admin',
        'is_parent': true,
        'club_count': 4,
      });
    });

    test('compte sans fiche membre : aucun rôle', () {
      expect(analyticsPersonProperties(_user()), {
        'max_role': analyticsNoRole,
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
}
