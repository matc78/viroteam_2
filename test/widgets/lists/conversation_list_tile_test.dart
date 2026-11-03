import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/widgets/lists/conversation_list_tile.dart';

ChatConversation _dm({String preview = 'On se voit à 18h ?'}) =>
    ChatConversation(
      id: 'dm',
      clubId: 'club',
      type: ChatConversationTypes.dm,
      title: 'Titre figé',
      participantUids: const ['me', 'peer'],
      writePolicy: ChatWritePolicies.open,
      lastMessageAt: DateTime(2026, 11, 3, 18),
      lastMessagePreview: preview,
      lastSenderUid: 'peer',
    );

Future<void> _pump(WidgetTester tester, Widget tile) {
  return tester.pumpWidget(
    MaterialApp(theme: ViroTheme.light, home: Scaffold(body: tile)),
  );
}

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  testWidgets('ConversationListTile : nom du pair, club et aperçu',
      (tester) async {
    var tapped = false;
    await _pump(
      tester,
      ConversationListTile(
        conversation: _dm(),
        clubName: 'AS Viro',
        clubColor: Colors.teal,
        peerDisplayName: 'Sam Martin',
        viewerUid: 'me',
        state: ChatUserState(
          id: 'club_dm',
          lastReadAt: DateTime(2026, 11, 3, 19),
        ),
        onTap: () => tapped = true,
      ),
    );

    expect(find.text('Sam Martin'), findsOneWidget);
    expect(find.text('Titre figé'), findsNothing);
    expect(find.text('AS Viro'), findsOneWidget);
    expect(find.text('On se voit à 18h ?'), findsOneWidget);
    await tester.tap(find.text('Sam Martin'));
    await tester.pumpAndSettle();
    expect(tapped, isTrue);
  });

  testWidgets('ConversationListTile : non-lus à la place de l’aperçu',
      (tester) async {
    await _pump(
      tester,
      ConversationListTile(
        conversation: _dm(),
        clubName: 'AS Viro',
        clubColor: Colors.teal,
        viewerUid: 'me',
        state: const ChatUserState(id: 'club_dm', unreadCount: 3),
        onTap: () {},
      ),
    );

    expect(find.text(AppCopy.chat.unreadPreview(3)), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('On se voit à 18h ?'), findsNothing);
  });

  testWidgets('ConversationListTile : en sourdine, pas de badge', (tester) async {
    await _pump(
      tester,
      ConversationListTile(
        conversation: _dm(),
        clubName: 'AS Viro',
        clubColor: Colors.teal,
        viewerUid: 'me',
        state: const ChatUserState(id: 'club_dm', unreadCount: 3, muted: true),
        onTap: () {},
      ),
    );

    expect(find.text('3'), findsNothing);
    expect(find.text('On se voit à 18h ?'), findsOneWidget);
  });
}
