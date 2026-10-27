import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/join_request.dart';
import 'package:viro_team_v2/widgets/lists/role_request_list_tile.dart';

void main() {
  testWidgets('RoleRequestListTile affiche la demande et ses actions',
      (tester) async {
    var accepted = false;
    var refused = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: RoleRequestListTile(
            request: const JoinRequest(
              id: 'r1',
              userId: 'u1',
              clubId: 'c1',
              roleRequested: MemberRoles.coach,
              status: JoinRequestStatus.pending,
              message: 'Je coache déjà les U11',
            ),
            member: const ClubMember(
              memberId: 'm1',
              role: MemberRoles.player,
              status: 'active',
              firstName: 'Sam',
              lastName: 'Martin',
            ),
            onAccept: () => accepted = true,
            onRefuse: () => refused = true,
          ),
        ),
      ),
    );

    expect(find.text('Sam Martin'), findsOneWidget);
    expect(find.textContaining('Coach'), findsOneWidget);
    expect(find.text('« Je coache déjà les U11 »'), findsOneWidget);
    await tester.tap(find.text('Accepter'));
    await tester.tap(find.text('Refuser'));
    expect(accepted, isTrue);
    expect(refused, isTrue);
  });
}
