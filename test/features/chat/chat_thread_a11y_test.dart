import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_attach_menu.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_message_bubble.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_reaction_pick_button.dart';
import 'package:viro_team_v2/models/chat_message.dart';

Future<void> _pump(WidgetTester tester, Widget child) {
  return tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(body: Center(child: child)),
    ),
  );
}

ChatMessage _message({
  Map<String, List<String>> reactions = const {},
  ChatMessageLocalStatus? localStatus,
}) {
  return ChatMessage(
    id: 'm1',
    conversationId: 'c1',
    clubId: 'club1',
    type: ChatMessageTypes.text,
    senderUid: 'u2',
    createdAt: DateTime(2026, 11, 4, 18, 30),
    text: 'Entraînement décalé à 19h',
    reactions: reactions,
    localStatus: localStatus,
  );
}

/// Actions personnalisées exposées par la bulle aux lecteurs d’écran.
Map<CustomSemanticsAction, VoidCallback> _customActions(WidgetTester tester) {
  final semantics = tester.widget<Semantics>(
    find.descendant(
      of: find.byType(ChatMessageBubble),
      matching: find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.customSemanticsActions != null,
      ),
    ),
  );
  return semantics.properties.customSemanticsActions!;
}

/// Exécute l’action personnalisée [label] de la bulle.
void _performCustomAction(WidgetTester tester, String label) {
  final action = _customActions(tester)[CustomSemanticsAction(label: label)];
  expect(action, isNotNull, reason: 'action « $label » absente');
  action!();
}

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  testWidgets('bulle : répondre et réagir sans geste', (tester) async {
    final handle = tester.ensureSemantics();
    final calls = <String>[];
    await _pump(
      tester,
      ChatMessageBubble(
        anchorKey: GlobalKey(),
        message: _message(
          reactions: const {
            '👍': ['u3'],
          },
        ),
        mine: false,
        viewerUid: 'u1',
        borderColor: Colors.blue,
        onLongPress: () => calls.add('actions'),
        onDoubleTap: () => calls.add('heart'),
        onOpenReactors: () => calls.add('reactors'),
        onReply: () => calls.add('reply'),
      ),
    );

    _performCustomAction(tester, AppCopy.chat.reply);
    _performCustomAction(tester, AppCopy.chat.reactWithHeart);
    _performCustomAction(tester, AppCopy.chat.messageActions);
    _performCustomAction(tester, AppCopy.chat.reactionReactors);
    expect(calls, ['reply', 'heart', 'actions', 'reactors']);
    handle.dispose();
  });

  testWidgets('bulle en lecture seule : pas d’action « Répondre »', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await _pump(
      tester,
      ChatMessageBubble(
        anchorKey: GlobalKey(),
        message: _message(),
        mine: false,
        viewerUid: 'u1',
        borderColor: Colors.blue,
        onLongPress: () {},
        onDoubleTap: () {},
        onOpenReactors: () {},
      ),
    );

    final labels = _customActions(tester).keys.map((action) => action.label);
    expect(labels, isNot(contains(AppCopy.chat.reply)));
    expect(labels, contains(AppCopy.chat.messageActions));
    handle.dispose();
  });

  testWidgets('chips de réaction : libellé et cible ≥ 44', (tester) async {
    final handle = tester.ensureSemantics();
    var opened = 0;
    await _pump(
      tester,
      ChatMessageBubble(
        anchorKey: GlobalKey(),
        message: _message(
          reactions: const {
            '👍': ['u3', 'u4'],
          },
        ),
        mine: false,
        viewerUid: 'u1',
        borderColor: Colors.blue,
        onLongPress: () {},
        onDoubleTap: () {},
        onOpenReactors: () => opened++,
      ),
    );

    final chips = find.bySemanticsLabel(RegExp('^Réactions : 👍 2'));
    expect(chips, findsOneWidget);
    final size = tester.getSize(chips);
    expect(size.height, greaterThanOrEqualTo(ViroSpacing.minTouchTarget));
    expect(size.width, greaterThanOrEqualTo(ViroSpacing.minTouchTarget));

    await tester.tap(chips);
    expect(opened, 1);
    handle.dispose();
  });

  testWidgets('« Réessayer » : cible ≥ 44', (tester) async {
    var retried = 0;
    await _pump(
      tester,
      ChatMessageBubble(
        anchorKey: GlobalKey(),
        message: _message(localStatus: ChatMessageLocalStatus.failed),
        mine: true,
        viewerUid: 'u2',
        borderColor: Colors.blue,
        onLongPress: () {},
        onDoubleTap: () {},
        onOpenReactors: () {},
        onRetry: () => retried++,
      ),
    );

    final retry = find.widgetWithText(TextButton, AppCopy.chat.retrySend);
    expect(
      tester.getSize(retry).height,
      greaterThanOrEqualTo(ViroSpacing.minTouchTarget),
    );
    await tester.tap(retry);
    // La bulle écoute aussi le double-tap : le tap simple attend son délai.
    await tester.pump(kDoubleTapTimeout);
    expect(retried, 1);
  });

  testWidgets('emoji du sélecteur : libellé, état et cible ≥ 44', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await _pump(
      tester,
      ChatReactionPickButton(emoji: '🔥', selected: true, onTap: () {}),
    );

    final button = find.bySemanticsLabel(AppCopy.chat.reactWithEmoji('🔥'));
    expect(button, findsOneWidget);
    expect(
      tester.getSemantics(button),
      matchesSemantics(
        label: AppCopy.chat.reactWithEmoji('🔥'),
        isButton: true,
        isSelected: true,
        hasSelectedState: true,
        hasTapAction: true,
      ),
    );
    expect(
      tester.getSize(find.byType(ChatReactionPickButton)),
      const Size.square(ViroSpacing.minTouchTarget),
    );
    expect(find.byTooltip(AppCopy.chat.reactWithEmoji('🔥')), findsOneWidget);
    handle.dispose();
  });

  testWidgets('bouton « + » du composer : cible ≥ 44 et tooltip', (
    tester,
  ) async {
    await _pump(
      tester,
      ChatAttachMenu(
        enabled: true,
        showPoll: false,
        onCamera: () {},
        onGallery: () {},
      ),
    );

    final size = tester.getSize(find.byType(ChatAttachMenu));
    expect(size.width, greaterThanOrEqualTo(ViroSpacing.minTouchTarget));
    expect(size.height, greaterThanOrEqualTo(ViroSpacing.minTouchTarget));
    expect(find.byTooltip(AppCopy.chat.attachAdd), findsOneWidget);
  });
}
