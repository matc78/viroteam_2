import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/lists/member_list_tile.dart';

void main() {
  const club = Club(
    id: 'c1',
    name: 'ASM Football',
    sport: 'Football',
    city: 'Paris',
  );

  const adminMember = ClubMember(
    memberId: 'm1',
    role: MemberRoles.admin,
    status: 'active',
    firstName: 'Paul',
    lastName: 'Admin',
    hasLinkedAccount: true,
  );

  testWidgets('MemberListTile affiche le rôle club par défaut', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MemberListTile(
            member: adminMember,
            club: club,
            viewerRole: MemberRoles.admin,
          ),
        ),
      ),
    );

    expect(find.text('Paul Admin'), findsOneWidget);
    expect(find.text(AppCopy.common.roleAdmin), findsOneWidget);
  });

  testWidgets(
    'MemberListTile utilise displayRole à la place du rôle club',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MemberListTile(
              member: adminMember,
              club: club,
              viewerRole: MemberRoles.player,
              showClubAdminActions: false,
              displayRole: ViroRole.player,
            ),
          ),
        ),
      );

      expect(find.text(AppCopy.common.rolePlayer), findsOneWidget);
      expect(find.text(AppCopy.common.roleAdmin), findsNothing);
    },
  );

  testWidgets(
    'MemberListTile met le nom en gras pour le membre en session',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MemberListTile(
              member: adminMember,
              club: club,
              viewerRole: MemberRoles.player,
              showClubAdminActions: false,
              displayRole: ViroRole.coach,
              isSessionMember: true,
            ),
          ),
        ),
      );

      final nameText = tester.widget<Text>(find.text('Paul Admin'));
      expect(nameText.style?.fontWeight, FontWeight.w800);
      expect(find.text(AppCopy.common.roleCoach), findsOneWidget);
    },
  );
}
