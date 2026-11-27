import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/lists/convocation_player_list_tile.dart';

const _member = ClubMember(
  memberId: 'm1',
  status: 'active',
  firstName: 'Léa',
  lastName: 'Martin',
  hasLinkedAccount: true,
);

void main() {
  Future<void> pumpToggleable(WidgetTester tester, {required bool convoked}) {
    var current = convoked;
    return tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => ConvocationPlayerListTile(
              member: _member,
              convoked: current,
              onChanged: (value) => setState(() => current = value),
            ),
          ),
        ),
      ),
    );
  }

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

  testWidgets('la ligne garde la même hauteur convoquée ou non',
      (tester) async {
    await pumpToggleable(tester, convoked: true);
    final convokedHeight =
        tester.getSize(find.byType(ConvocationPlayerListTile)).height;

    await tester.tap(find.byType(ConvocationPlayerListTile));
    await tester.pumpAndSettle();
    expect(find.text(AppCopy.planning.notConvoked), findsOneWidget);
    expect(
      tester.getSize(find.byType(ConvocationPlayerListTile)).height,
      convokedHeight,
    );
  });

  testWidgets('sparring : badge Sparring affiché', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: ConvocationPlayerListTile(
            member: _member,
            convoked: false,
            sparring: true,
            onChanged: (_) {},
          ),
        ),
      ),
    );

    expect(find.text(AppCopy.common.roleSparring), findsOneWidget);
    expect(find.text(AppCopy.planning.notConvoked), findsOneWidget);
  });

  testWidgets('désactivée : le tap ne change rien', (tester) async {
    var changed = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: ConvocationPlayerListTile(
            member: _member,
            convoked: true,
            enabled: false,
            onChanged: (_) => changed = true,
          ),
        ),
      ),
    );

    await tester.tap(find.byType(ConvocationPlayerListTile));
    expect(changed, isFalse);
  });
}
