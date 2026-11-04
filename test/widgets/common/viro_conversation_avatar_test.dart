import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_conversation_avatar.dart';

Future<void> _pump(WidgetTester tester, Widget avatar) {
  return tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(body: Center(child: avatar)),
    ),
  );
}

void main() {
  testWidgets('DM sans photo : initiale à la taille demandée', (tester) async {
    await _pump(
      tester,
      const ViroConversationAvatar(
        size: ViroChat.avatarHeader,
        initial: 'S',
        color: Colors.teal,
        groupBackground: Colors.green,
      ),
    );

    expect(find.text('S'), findsOneWidget);
    expect(
      tester.getSize(find.byType(ViroConversationAvatar)),
      const Size.square(ViroChat.avatarHeader),
    );
  });

  testWidgets('canal : mégaphone, jamais la photo', (tester) async {
    await _pump(
      tester,
      const ViroConversationAvatar(
        size: ViroChat.avatarInbox,
        color: Colors.teal,
        groupBackground: Colors.purple,
        isChannel: true,
        photoUrl: 'https://cdn.test/canal.png',
      ),
    );

    final icon = tester.widget<ViroIcon>(find.byType(ViroIcon));
    expect(icon.icon, ViroIcons.megaphone);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('groupe sans photo : tap = modifier, pastille appareil photo',
      (tester) async {
    var edited = false;
    await _pump(
      tester,
      ViroConversationAvatar(
        size: ViroChat.avatarHero,
        color: Colors.teal,
        groupBackground: Colors.green,
        isGroup: true,
        showEditBadge: true,
        onEdit: () => edited = true,
      ),
    );

    final icons = tester
        .widgetList<ViroIcon>(find.byType(ViroIcon))
        .map((icon) => icon.icon)
        .toList();
    expect(icons, containsAll([ViroIcons.groups, ViroIcons.camera]));
    await tester.tap(find.byType(ViroConversationAvatar));
    expect(edited, isTrue);
  });
}
