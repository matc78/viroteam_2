import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/features/members/widgets/member_permissions_sheet.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/widgets/lists/member_permission_list_tile.dart';

void main() {
  testWidgets('un droit impliqué est coché et figé', (tester) async {
    final scrollController = ScrollController();
    addTearDown(scrollController.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: MemberPermissionsSheet(
            member: const ClubMember(
              memberId: 'm1',
              status: 'active',
              firstName: 'Léa',
              permissions: {ClubPermission.manageFees, ClubPermission.viewFees},
            ),
            accentColor: ViroColors.sportOrange,
            coachPermissions: CoachPermissions.defaults,
            coachedTeamNames: const [],
            scrollController: scrollController,
          ),
        ),
      ),
    );

    final viewFeesLabel = AppCopy.permissions.permissionLabel(
      ClubPermission.viewFees,
    );
    await tester.scrollUntilVisible(
      find.text(viewFeesLabel),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    final tile = tester.widget<MemberPermissionListTile>(
      find.ancestor(
        of: find.text(viewFeesLabel),
        matching: find.byType(MemberPermissionListTile),
      ),
    );
    expect(tile.value, isTrue);
    expect(tile.onChanged, isNull);
  });
}
