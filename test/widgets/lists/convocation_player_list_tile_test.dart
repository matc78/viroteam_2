import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/lists/convocation_player_list_tile.dart';

const _member = ClubMember(
  memberId: 'm1',
  role: MemberRoles.player,
  status: 'active',
  firstName: 'Léa',
  lastName: 'Martin',
  hasLinkedAccount: true,
);

void main() {
  testWidgets('décocher un convoqué le retire, recocher le réintègre',
      (tester) async {
    var convoked = true;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => ConvocationPlayerListTile(
              member: _member,
              convoked: convoked,
              onChanged: (value) => setState(() => convoked = value),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Léa Martin'), findsOneWidget);
    expect(find.text(AppCopy.planning.notConvoked), findsNothing);

    await tester.tap(find.byType(ConvocationPlayerListTile));
    await tester.pump();
    expect(convoked, isFalse);
    expect(find.text(AppCopy.planning.notConvoked), findsOneWidget);

    await tester.tap(find.byType(ConvocationPlayerListTile));
    await tester.pump();
    expect(convoked, isTrue);
  });
}
