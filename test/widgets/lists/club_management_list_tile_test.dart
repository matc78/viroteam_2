import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/lists/club_management_list_tile.dart';

void main() {
  testWidgets('ClubManagementListTile affiche titre et sous-titre',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: ClubManagementListTile(
            title: 'Gérer les membres',
            subtitle: '96 membres',
            icon: ViroIcons.groups,
            accentColor: Colors.deepOrange,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('Gérer les membres'), findsOneWidget);
    expect(find.text('96 membres'), findsOneWidget);
    await tester.tap(find.text('Gérer les membres'));
    expect(tapped, isTrue);
  });
}
