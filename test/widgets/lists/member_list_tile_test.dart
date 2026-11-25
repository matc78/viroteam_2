import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/lists/member_list_tile.dart';

void main() {
  const club = Club(
    id: 'c1',
    name: 'ASM Football',
    sport: 'Football',
    city: 'Paris',
  );

  /// Admin qui entraîne aussi l'équipe t1 : deux badges dérivés.
  const adminCoach = ClubMember(
    memberId: 'm1',
    permissions: {ClubPermission.admin},
    coachTeamIds: ['t1'],
    teamIds: ['t1'],
    status: 'active',
    firstName: 'Paul',
    lastName: 'Admin',
    hasLinkedAccount: true,
  );

  Future<void> pump(WidgetTester tester, Widget tile) =>
      tester.pumpWidget(MaterialApp(home: Scaffold(body: tile)));

  testWidgets('MemberListTile affiche les badges dérivés de la fiche', (
    tester,
  ) async {
    await pump(tester, const MemberListTile(member: adminCoach, club: club));

    expect(find.text('Paul Admin'), findsOneWidget);
    expect(find.text(AppCopy.common.roleAdmin), findsOneWidget);
    expect(find.text(AppCopy.common.roleCoach), findsOneWidget);
  });

  testWidgets('MemberListTile : badge Membre sans droit admin ni équipe', (
    tester,
  ) async {
    const treasurer = ClubMember(
      memberId: 'm2',
      permissions: {ClubPermission.manageFees, ClubPermission.viewFees},
      status: 'active',
      firstName: 'Léa',
      lastName: 'Trésor',
      hasLinkedAccount: true,
    );
    await pump(tester, const MemberListTile(member: treasurer, club: club));

    expect(find.byType(ViroRoleBadge), findsOneWidget);
    expect(find.text(AppCopy.common.roleMember), findsOneWidget);
  });

  testWidgets('MemberListTile utilise displayRole à la place des badges', (
    tester,
  ) async {
    await pump(
      tester,
      const MemberListTile(
        member: adminCoach,
        club: club,
        showClubAdminActions: false,
        displayRole: ViroRole.player,
      ),
    );

    expect(find.text(AppCopy.common.rolePlayer), findsOneWidget);
    expect(find.text(AppCopy.common.roleAdmin), findsNothing);
  });

  testWidgets('MemberListTile met le nom en gras pour le membre en session', (
    tester,
  ) async {
    await pump(
      tester,
      const MemberListTile(
        member: adminCoach,
        club: club,
        showClubAdminActions: false,
        displayRole: ViroRole.coach,
        isSessionMember: true,
      ),
    );

    final nameText = tester.widget<Text>(find.text('Paul Admin'));
    expect(nameText.style?.fontWeight, FontWeight.w800);
    expect(find.text(AppCopy.common.roleCoach), findsOneWidget);
  });

  testWidgets('MemberListTile embedded : ligne plate et retrait', (
    tester,
  ) async {
    var removed = false;
    await pump(
      tester,
      MemberListTile(
        member: adminCoach,
        club: club,
        showClubAdminActions: false,
        embedded: true,
        displayRole: ViroRole.coach,
        onRemove: () => removed = true,
      ),
    );

    expect(find.byType(ViroCard), findsNothing);
    expect(find.text('Paul Admin'), findsOneWidget);
    await tester.tap(find.byTooltip(AppCopy.members.removeFromTeam));
    expect(removed, isTrue);
  });

  testWidgets('MemberListTile : menu seulement avec des actions fournies', (
    tester,
  ) async {
    await pump(tester, const MemberListTile(member: adminCoach, club: club));
    expect(find.byType(PopupMenuButton<String>), findsNothing);

    var editedRights = false;
    await pump(
      tester,
      MemberListTile(
        member: adminCoach,
        club: club,
        onEditRights: () => editedRights = true,
      ),
    );
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    expect(find.text(AppCopy.common.delete), findsNothing);
    await tester.tap(find.text(AppCopy.permissions.manageRights));
    await tester.pumpAndSettle();
    expect(editedRights, isTrue);
  });
}
