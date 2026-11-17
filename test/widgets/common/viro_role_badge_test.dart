import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

void main() {
  group('correspondances de badges', () {
    test('MemberBadge.member → ViroRole.member, id de chat « member »', () {
      expect(viroRoleFromBadge(MemberBadge.member), ViroRole.member);
      expect(viroRoleFromChatSenderRole(ChatBadgeIds.member), ViroRole.member);
      expect(viroRoleFromChatSenderRole('inconnu'), isNull);
    });

    test('pas de bordure de bulle de chat pour un simple membre', () {
      expect(chatBubbleBorderForRole(ChatBadgeIds.member), isNull);
      expect(chatBubbleBorderForRole('coach'), ViroColors.coachBadgeEnd);
    });
  });

  group('viroRoleForClubSession', () {
    test('badge de la fiche, Parent à la place de Membre', () {
      expect(
        viroRoleForClubSession(memberBadge: MemberBadge.coach),
        ViroRole.coach,
      );
      expect(
        viroRoleForClubSession(
          memberBadge: MemberBadge.admin,
          hasFamilyLinks: true,
        ),
        ViroRole.admin,
      );
      expect(
        viroRoleForClubSession(memberBadge: MemberBadge.member),
        ViroRole.member,
      );
      expect(
        viroRoleForClubSession(
          memberBadge: MemberBadge.member,
          hasFamilyLinks: true,
        ),
        ViroRole.parent,
      );
      expect(viroRoleForClubSession(hasFamilyLinks: true), ViroRole.parent);
      expect(viroRoleForClubSession(), isNull);
    });
  });

  group('viroRolesForClubSelector', () {
    test('badges de la fiche ; Parent remplace un seul badge Membre', () {
      expect(
        viroRolesForClubSelector(
          memberBadges: const [MemberBadge.coach, MemberBadge.player],
          hasFamilyLinks: true,
        ),
        [ViroRole.coach, ViroRole.player],
      );
      expect(
        viroRolesForClubSelector(memberBadges: const [MemberBadge.member]),
        [ViroRole.member],
      );
      expect(
        viroRolesForClubSelector(
          memberBadges: const [MemberBadge.member],
          hasFamilyLinks: true,
        ),
        [ViroRole.parent],
      );
      expect(viroRolesForClubSelector(hasFamilyLinks: true), [ViroRole.parent]);
      expect(viroRolesForClubSelector(), isEmpty);
    });
  });

  testWidgets('badge Membre : aplat gris sans dégradé ni halo', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: Center(child: ViroRoleBadge(role: ViroRole.member)),
        ),
      ),
    );

    expect(find.text(AppCopy.common.roleMember), findsOneWidget);
    final container = tester.widget<Container>(
      find
          .descendant(
            of: find.byType(ViroRoleBadge),
            matching: find.byType(Container),
          )
          .first,
    );
    final decoration = container.decoration! as BoxDecoration;
    expect(decoration.color, ViroColors.memberBadgeBackground);
    expect(decoration.gradient, isNull);
    expect(decoration.boxShadow, isNull);
  });
}
