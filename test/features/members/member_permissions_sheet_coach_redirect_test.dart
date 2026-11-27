import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/features/members/widgets/coach_rights_redirect_dialog.dart';
import 'package:viro_team_v2/features/members/widgets/member_permissions_sheet.dart';
import 'package:viro_team_v2/models/club_member.dart';

const _coach = ClubMember(
  memberId: 'm1',
  status: 'active',
  firstName: 'Léa',
  lastName: 'Martin',
  hasLinkedAccount: true,
  coachTeamIds: ['t1'],
);

void main() {
  Future<void> openSheet(
    WidgetTester tester, {
    required VoidCallback? onEditCoachRights,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showMemberPermissionsSheet(
                context,
                member: _coach,
                accentColor: Colors.blue,
                coachPermissions: CoachPermissions.defaults,
                coachedTeamNames: const ['Senior A'],
                onEditCoachRights: onEditCoachRights,
              ),
              child: const Text('ouvrir'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
  }

  Finder firstCoachCapability() =>
      find.text(AppCopy.club.permCreateEventsLabel);

  testWidgets('admin : « Go » ferme la feuille et ouvre les paramètres',
      (tester) async {
    var opened = 0;
    await openSheet(tester, onEditCoachRights: () => opened++);

    await tester.tap(firstCoachCapability());
    await tester.pumpAndSettle();
    expect(find.text(AppCopy.permissions.coachRightsRedirectTitle),
        findsOneWidget);
    expect(find.text(AppCopy.permissions.coachRightsRedirectBody),
        findsOneWidget);

    await tester.tap(find.text(AppCopy.permissions.coachRightsRedirectGo));
    await tester.pumpAndSettle();
    expect(opened, 1);
    expect(find.byType(MemberPermissionsSheet), findsNothing);
  });

  testWidgets('dialog : prévient si brouillon non enregistré', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => showCoachRightsRedirectDialog(
              context,
              discardUnsavedChanges: true,
            ),
            child: const Text('ouvrir'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
    expect(find.text(AppCopy.permissions.coachRightsRedirectBodyUnsaved),
        findsOneWidget);
  });

  testWidgets('admin : « Non » reste sur la feuille', (tester) async {
    var opened = 0;
    await openSheet(tester, onEditCoachRights: () => opened++);

    await tester.tap(firstCoachCapability());
    await tester.pumpAndSettle();
    await tester.tap(find.text(AppCopy.permissions.coachRightsRedirectNo));
    await tester.pumpAndSettle();
    expect(opened, 0);
    expect(find.byType(MemberPermissionsSheet), findsOneWidget);
  });

  testWidgets('sans callback : pas de popup', (tester) async {
    await openSheet(tester, onEditCoachRights: null);

    await tester.tap(firstCoachCapability());
    await tester.pumpAndSettle();
    expect(find.text(AppCopy.permissions.coachRightsRedirectTitle),
        findsNothing);
  });
}
