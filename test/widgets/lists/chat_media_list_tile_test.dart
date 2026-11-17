import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/lists/chat_media_list_tile.dart';

void main() {
  testWidgets('ChatMediaListTile : vignette carrée tappable', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: Center(
            child: ChatMediaListTile(
              imageUrl: 'https://cdn.test/photo.jpg',
              onTap: () => tapped = true,
            ),
          ),
        ),
      ),
    );

    expect(
      tester.getSize(find.byType(ChatMediaListTile)),
      const Size.square(ChatMediaListTile.size),
    );
    await tester.tap(find.byType(ChatMediaListTile));
    expect(tapped, isTrue);
  });
}
