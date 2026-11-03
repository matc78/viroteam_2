import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/lists/chat_reactor_list_tile.dart';

Future<void> _pump(WidgetTester tester, Widget tile) {
  return tester.pumpWidget(
    MaterialApp(theme: ViroTheme.light, home: Scaffold(body: tile)),
  );
}

void main() {
  testWidgets('ChatReactorListTile : ma réaction est retirable', (tester) async {
    var tapped = false;
    await _pump(
      tester,
      ChatReactorListTile(
        emoji: '🔥',
        firstName: 'Sam',
        mine: true,
        onTap: () => tapped = true,
      ),
    );

    expect(find.text(AppCopy.chat.you), findsOneWidget);
    expect(find.text(AppCopy.chat.reactionRemoveMine), findsOneWidget);
    expect(find.text('🔥'), findsOneWidget);
    // Initiale du prénom, jamais celle de « Vous ».
    expect(find.text('S'), findsOneWidget);
    await tester.tap(find.byType(ChatReactorListTile));
    expect(tapped, isTrue);
  });

  testWidgets('ChatReactorListTile : réaction d’un autre non tappable',
      (tester) async {
    var tapped = false;
    await _pump(
      tester,
      ChatReactorListTile(
        emoji: '👍',
        firstName: '',
        mine: false,
        onTap: () => tapped = true,
      ),
    );

    expect(find.text(AppCopy.common.memberFallback), findsOneWidget);
    expect(find.text('?'), findsOneWidget);
    await tester.tap(find.byType(ChatReactorListTile));
    expect(tapped, isFalse);
  });
}
