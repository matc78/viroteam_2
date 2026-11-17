import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/models/parent_link.dart';
import 'package:viro_team_v2/models/viro_user.dart';

ViroUser _user({
  List<String> memberships = const [],
  List<ParentLink> parentLinks = const [],
  bool profileCompleted = false,
}) {
  return ViroUser(
    uid: 'u1',
    email: 'u1@example.com',
    emailNorm: 'u1@example.com',
    firstName: 'Tristan',
    lastName: 'Heraud',
    displayName: 'Tristan Heraud',
    memberClubIds: memberships,
    parentLinks: parentLinks,
    profileCompleted: profileCompleted,
  );
}

void main() {
  group('lien d’invitation à froid', () {
    test('isJoinRoute reconnaît /join avec ou sans code', () {
      expect(isJoinRoute('/join?code=ABC'), isTrue);
      expect(isJoinRoute(AppRoutes.join), isTrue);
      expect(isJoinRoute(AppRoutes.joinPreview), isFalse);
      expect(isJoinRoute(AppRoutes.home), isFalse);
    });

    test('consumeJoin ne prend que les liens d’invitation', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(pendingDeepLinkProvider.notifier);

      notifier.set(PendingDeepLink(route: AppRoutes.clubPlanningPath('c1')));
      expect(notifier.consumeJoin(), isNull);
      expect(container.read(pendingDeepLinkProvider), isNotNull);

      notifier.set(const PendingDeepLink(route: '/join?code=ABC'));
      expect(notifier.consumeJoin()?.route, '/join?code=ABC');
      expect(container.read(pendingDeepLinkProvider), isNull);
    });
  });

  group('needsClubSetupRedirect', () {
    test('fondateur sans club ni profil finalisé → création de club', () {
      expect(
        needsClubSetupRedirect(
          user: _user(),
          intent: SignUpIntent.founder,
          inInvitationFlow: false,
        ),
        isTrue,
      );
    });

    test('jamais pendant un parcours d’invitation', () {
      expect(
        needsClubSetupRedirect(
          user: _user(),
          intent: SignUpIntent.founder,
          inInvitationFlow: true,
        ),
        isFalse,
      );
    });

    test('jamais pour une intention « rejoindre » ni avec un club', () {
      expect(
        needsClubSetupRedirect(
          user: _user(),
          intent: SignUpIntent.join,
          inInvitationFlow: false,
        ),
        isFalse,
      );
      expect(
        needsClubSetupRedirect(
          user: _user(memberships: const ['c1']),
          intent: SignUpIntent.founder,
          inInvitationFlow: false,
        ),
        isFalse,
      );
    });
  });

  group('completeNamesLocation', () {
    test('garde le code et force « join » pendant une invitation', () {
      final location = Uri.parse(
        completeNamesLocation(
          intent: SignUpIntent.founder,
          inInvitationFlow: true,
          code: ' ABC ',
        ),
      );
      expect(location.path, AppRoutes.signup);
      expect(location.queryParameters['complete'], '1');
      expect(location.queryParameters['intent'], 'join');
      expect(location.queryParameters['code'], 'ABC');
    });

    test('fondateur hors invitation, sans code', () {
      final location = Uri.parse(
        completeNamesLocation(
          intent: SignUpIntent.founder,
          inInvitationFlow: false,
        ),
      );
      expect(location.queryParameters['intent'], 'founder');
      expect(location.queryParameters.containsKey('code'), isFalse);
    });
  });

  group('pendingDeepLinkClubToApply', () {
    final parent = _user(
      memberships: const ['c0'],
      parentLinks: const [
        ParentLink(
          clubId: 'c1',
          memberId: 'm1',
          relation: 'parent',
          status: GuardianStatuses.active,
        ),
      ],
    );

    test('push RSVP vers /home : le club (et donc l’enfant) est appliqué', () {
      const link = PendingDeepLink(
        route: AppRoutes.home,
        clubId: 'c1',
        memberId: 'm1',
      );
      expect(pendingDeepLinkTarget(link, parent), AppRoutes.home);
      expect(pendingDeepLinkClubToApply(link, parent), 'c1');
    });

    test('club inaccessible ou absent : rien à appliquer', () {
      expect(
        pendingDeepLinkClubToApply(
          const PendingDeepLink(route: AppRoutes.home, clubId: 'c9'),
          parent,
        ),
        isNull,
      );
      expect(
        pendingDeepLinkClubToApply(
          const PendingDeepLink(route: AppRoutes.home),
          parent,
        ),
        isNull,
      );
      expect(pendingDeepLinkClubToApply(null, parent), isNull);
    });
  });
}
