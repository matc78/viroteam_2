import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_reaction_emojis.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_reaction_pick_button.dart';
import 'package:viro_team_v2/models/chat_message.dart';

/// Sheet d’actions sur un message (répondre, copier, éditer, réactions, supprimer).
void showChatMessageActionsSheet({
  required BuildContext context,
  required ChatMessage message,
  required bool mine,
  required String? viewerUid,
  required VoidCallback onReply,
  required VoidCallback onCopy,
  required VoidCallback onEdit,
  required VoidCallback onDelete,
  required ValueChanged<String> onReact,
  required void Function(ChatMessage message, Set<String> myEmojis)
      onOpenEmojiPicker,
}) {
  final canCopy = (message.text ?? '').trim().isNotEmpty &&
      message.type == ChatMessageTypes.text;
  final canEdit =
      mine && !message.isDeleted && message.type == ChatMessageTypes.text;
  final myEmojis = <String>{
    for (final entry in message.reactions.entries)
      if (viewerUid != null && entry.value.contains(viewerUid)) entry.key,
  };

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!message.isDeleted)
            ListTile(
              leading: ViroIcon(
                ViroIcons.chat,
                color: ViroColors.primary600,
              ),
              title: Text(AppCopy.chat.reply),
              onTap: () {
                Navigator.pop(ctx);
                onReply();
              },
            ),
          if (canCopy)
            ListTile(
              leading: ViroIcon(
                ViroIcons.copy,
                color: ViroColors.primary600,
              ),
              title: Text(AppCopy.chat.copyMessage),
              onTap: () {
                Navigator.pop(ctx);
                onCopy();
              },
            ),
          if (canEdit)
            ListTile(
              leading: ViroIcon(
                ViroIcons.edit,
                color: ViroColors.primary600,
              ),
              title: Text(AppCopy.chat.editMessage),
              onTap: () {
                Navigator.pop(ctx);
                onEdit();
              },
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.sm,
              ViroSpacing.xs,
              ViroSpacing.sm,
              ViroSpacing.sm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppCopy.chat.reactions,
                  style: Theme.of(ctx).textTheme.labelLarge?.copyWith(
                        color: ViroColors.gray600,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ...chatReactionEmojis.map(
                      (emoji) => ChatReactionPickButton(
                        emoji: emoji,
                        selected: myEmojis.contains(emoji),
                        onTap: () {
                          Navigator.pop(ctx);
                          onReact(emoji);
                        },
                      ),
                    ),
                    InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: () {
                        Navigator.pop(ctx);
                        onOpenEmojiPicker(message, myEmojis);
                      },
                      child: Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: ViroColors.gray50,
                          border: Border.all(color: ViroColors.gray200),
                        ),
                        child: ViroIcon(
                          ViroIcons.smiley,
                          color: ViroColors.primary600,
                          size: 20,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (mine)
            ListTile(
              leading: ViroIcon(
                ViroIcons.trash,
                color: ViroColors.error,
              ),
              title: Text(
                AppCopy.chat.deleteMessage,
                style: const TextStyle(color: ViroColors.error),
              ),
              onTap: () {
                Navigator.pop(ctx);
                onDelete();
              },
            ),
        ],
      ),
    ),
  );
}

/// Grille d’émojis élargie pour réagir au message.
void showChatEmojiPickerSheet({
  required BuildContext context,
  required Set<String> myEmojis,
  required ValueChanged<String> onReact,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      final height = MediaQuery.sizeOf(ctx).height * 0.45;
      return SafeArea(
        child: SizedBox(
          height: height,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.md,
                  ViroSpacing.sm,
                  ViroSpacing.sm,
                  ViroSpacing.xs,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        AppCopy.chat.moreEmojis,
                        style: Theme.of(ctx).textTheme.titleMedium,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: ViroIcon(ViroIcons.close),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.sm,
                    vertical: ViroSpacing.xs,
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 8,
                    mainAxisSpacing: 4,
                    crossAxisSpacing: 4,
                  ),
                  itemCount: chatExtendedReactionEmojis.length,
                  itemBuilder: (context, index) {
                    final emoji = chatExtendedReactionEmojis[index];
                    return ChatReactionPickButton(
                      emoji: emoji,
                      selected: myEmojis.contains(emoji),
                      onTap: () {
                        Navigator.pop(ctx);
                        onReact(emoji);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
