import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_composer.dart';

Future<TextEditingController> _pump(
  WidgetTester tester, {
  bool editing = false,
  VoidCallback? onSend,
  VoidCallback? onCancelEdit,
}) async {
  final controller = TextEditingController();
  addTearDown(controller.dispose);
  await tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(
        body: Align(
          alignment: Alignment.bottomCenter,
          child: ChatThreadComposer(
            controller: controller,
            canPoll: false,
            replyToSenderName: '',
            replyPreview: '',
            showReplyBar: false,
            onClearReply: () {},
            onSend: onSend ?? () {},
            onCamera: () {},
            onGallery: () {},
            editing: editing,
            onCancelEdit: onCancelEdit,
          ),
        ),
      ),
    ),
  );
  return controller;
}

IconButton _sendButton(WidgetTester tester, String tooltip) =>
    tester.widget<IconButton>(
      find.ancestor(
        of: find.byTooltip(tooltip),
        matching: find.byType(IconButton),
      ),
    );

void main() {
  testWidgets('envoi grisé tant que le champ est vide', (tester) async {
    var sent = 0;
    final controller = await _pump(tester, onSend: () => sent++);

    expect(_sendButton(tester, AppCopy.chat.sendMessage).onPressed, isNull);

    controller.text = '   ';
    await tester.pump();
    expect(_sendButton(tester, AppCopy.chat.sendMessage).onPressed, isNull);

    controller.text = 'On y va';
    await tester.pump();
    await tester.tap(find.byTooltip(AppCopy.chat.sendMessage));
    expect(sent, 1);
  });

  testWidgets('mode modification : bandeau, annuler et enregistrer',
      (tester) async {
    var cancelled = false;
    final controller = await _pump(
      tester,
      editing: true,
      onCancelEdit: () => cancelled = true,
    );
    controller.text = 'Texte corrigé';
    await tester.pump();

    expect(find.text(AppCopy.chat.editingMessage), findsOneWidget);
    expect(
      _sendButton(tester, AppCopy.chat.saveEdit).onPressed,
      isNotNull,
    );
    await tester.tap(find.byTooltip(AppCopy.chat.cancelEdit));
    expect(cancelled, isTrue);
  });
}
