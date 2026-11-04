import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/lists/chat_dm_target_list_tile.dart';

void main() {
  testWidgets('ChatDmTargetListTile affiche le destinataire et se coche',
      (tester) async {
    bool? changedTo;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: ChatDmTargetListTile(
            label: 'Sam Martin',
            role: MemberRoles.coach,
            selected: false,
            onChanged: (value) => changedTo = value,
          ),
        ),
      ),
    );

    expect(find.text('Sam Martin'), findsOneWidget);
    expect(find.text(AppCopy.common.roleCoach), findsOneWidget);
    await tester.tap(find.byType(Checkbox));
    expect(changedTo, isTrue);
  });
}
