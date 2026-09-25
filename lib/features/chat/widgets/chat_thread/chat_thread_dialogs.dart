import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';

/// Dialog de renommage d’une conversation ; retourne le titre ou null (annulé).
Future<String?> showChatRenameConversationDialog({
  required BuildContext context,
  required String initialTitle,
}) async {
  final controller = TextEditingController(text: initialTitle);
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(AppCopy.chat.renameConversation),
      content: TextField(
        controller: controller,
        decoration: InputDecoration(hintText: AppCopy.chat.renameHint),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(AppCopy.common.cancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(AppCopy.common.save),
        ),
      ],
    ),
  );
  final title = controller.text;
  controller.dispose();
  if (ok != true) return null;
  return title;
}

/// Dialog de confirmation de suppression d’un message.
Future<bool> showChatDeleteMessageDialog(BuildContext context) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(AppCopy.chat.deleteMessage),
      content: Text(AppCopy.chat.deleteMessageConfirm),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(AppCopy.common.cancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(AppCopy.common.delete),
        ),
      ],
    ),
  );
  return ok == true;
}

/// Dialog d’édition de texte ; retourne le nouveau texte ou null.
Future<String?> showChatEditMessageDialog({
  required BuildContext context,
  required String initialText,
}) async {
  final controller = TextEditingController(text: initialText);
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(AppCopy.chat.editMessage),
      content: TextField(
        controller: controller,
        autofocus: true,
        minLines: 2,
        maxLines: 6,
        decoration: InputDecoration(hintText: AppCopy.chat.editMessageHint),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(AppCopy.common.cancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(AppCopy.common.save),
        ),
      ],
    ),
  );
  final next = controller.text.trim();
  controller.dispose();
  if (ok != true || next.isEmpty || next == initialText.trim()) {
    return null;
  }
  return next;
}

/// Copie [text] dans le presse-papiers et affiche un snackbar.
Future<void> copyChatMessageText({
  required BuildContext context,
  required String text,
}) async {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return;
  await Clipboard.setData(ClipboardData(text: trimmed));
  if (!context.mounted) return;
  ViroSnackBar.show(context, AppCopy.chat.messageCopied);
}
