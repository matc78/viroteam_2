import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/models/parent_link.dart';
import 'package:viro_team_v2/models/viro_user.dart';

ViroUser _user({
  List<ClubMembershipSummary> memberships = const [],
  List<ParentLink> parentLinks = const [],
}) {
  return ViroUser(
    uid: 'u1',
    email: 'u1@example.com',
    emailNorm: 'u1@example.com',
    firstName: 'Tristan',
    lastName: 'Heraud',
    displayName: 'Tristan Heraud',
    clubMemberships: memberships,
    parentLinks: parentLinks,
  );
}

void main() {
  group('pendingDeepLinkProvider', () {
    test('vide au départ, consume renvoie puis efface', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(pendingDeepLinkProvider), isNull);

      container.read(pendingDeepLinkProvider.notifier).set(
            PendingDeepLink(
              route: AppRoutes.clubPlanningPath('c1'),
              clubId: 'c1',
            ),
          );
      final stored = container.read(pendingDeepLinkProvider);
      expect(stored?.route, AppRoutes.clubPlanningPath('c1'));
      expect(stored?.clubId, 'c1');

      final consumed =
          container.read(pendingDeepLinkProvider.notifier).consume();
      expect(consumed?.route, AppRoutes.clubPlanningPath('c1'));
      expect(container.read(pendingDeepLinkProvider), isNull);
      expect(
        container.read(pendingDeepLinkProvider.notifier).consume(),
        isNull,
      );
    });

    test('clear efface la destination', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container
          .read(pendingDeepLinkProvider.notifier)
          .set(const PendingDeepLink(route: AppRoutes.home));
      container.read(pendingDeepLinkProvider.notifier).clear();
      expect(container.read(pendingDeepLinkProvider), isNull);
    });
  });

  group('deepLinkClubId', () {
    test('renvoie le clubId, null si absent ou vide', () {
      expect(
        deepLinkClubId(Uri.parse('viroteam://planning?clubId=c1&date=x')),
        'c1',
      );
      expect(deepLinkClubId(Uri.parse('viroteam://planning')), isNull);
      expect(deepLinkClubId(Uri.parse('viroteam://planning?clubId=')), isNull);
    });
  });

  group('userCanOpenClub', () {
    test('membre du club', () {
      final user = _user(
        memberships: const [
          ClubMembershipSummary(clubId: 'c1', role: MemberRoles.player),
        ],
      );
      expect(userCanOpenClub(user, 'c1'), isTrue);
      expect(userCanOpenClub(user, 'c2'), isFalse);
    });

    test('parent avec lien actif seulement', () {
      final user = _user(
        parentLinks: const [
          ParentLink(
            clubId: 'c1',
            memberId: 'm1',
            relation: 'parent',
            status: GuardianStatuses.active,
          ),
          ParentLink(
            clubId: 'c2',
            memberId: 'm2',
            relation: 'parent',
            status: GuardianStatuses.pending,
          ),
        ],
      );
      expect(userCanOpenClub(user, 'c1'), isTrue);
      expect(userCanOpenClub(user, 'c2'), isFalse);
    });

    test('aucun club', () {
      expect(userCanOpenClub(_user(), 'c1'), isFalse);
    });
  });
}
