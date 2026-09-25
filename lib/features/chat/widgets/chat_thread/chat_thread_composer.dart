import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_attach_menu.dart';

/// Bandeau « répondre à » + champ de saisie + envoi du fil de conversation.
class ChatThreadComposer extends StatelessWidget {
  const ChatThreadComposer({
    super.key,
    required this.controller,
    required this.sending,
    required this.canPoll,
    required this.replyToSenderName,
    required this.replyPreview,
    required this.showReplyBar,
    required this.onClearReply,
    required this.onSend,
    required this.onCamera,
    required this.onGallery,
    this.onPoll,
  });

  final TextEditingController controller;
  final bool sending;
  final bool canPoll;
  final String replyToSenderName;
  final String replyPreview;
  final bool showReplyBar;
  final VoidCallback onClearReply;
  final VoidCallback onSend;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback? onPoll;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showReplyBar)
          Material(
            color: ViroColors.primary50,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
                vertical: ViroSpacing.xs,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${AppCopy.chat.replyTo} $replyToSenderName',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: ViroColors.primary600,
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                        Text(
                          replyPreview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: AppCopy.chat.cancelReply,
                    onPressed: onClearReply,
                    icon: ViroIcon(
                      ViroIcons.close,
                      color: ViroColors.primary600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.xs,
              ViroSpacing.screenHorizontal,
              ViroSpacing.sm,
            ),
            child: Row(
              children: [
                ChatAttachMenu(
                  enabled: !sending,
                  showPoll: canPoll,
                  onCamera: onCamera,
                  onGallery: onGallery,
                  onPoll: canPoll ? onPoll : null,
                ),
                const SizedBox(width: ViroSpacing.xs),
                Expanded(
                  child: Focus(
                    onKeyEvent: (node, event) {
                      if (event is! KeyDownEvent) {
                        return KeyEventResult.ignored;
                      }
                      if (event.logicalKey != LogicalKeyboardKey.enter &&
                          event.logicalKey != LogicalKeyboardKey.numpadEnter) {
                        return KeyEventResult.ignored;
                      }
                      if (HardwareKeyboard.instance.isShiftPressed) {
                        return KeyEventResult.ignored;
                      }
                      onSend();
                      return KeyEventResult.handled;
                    },
                    child: TextField(
                      controller: controller,
                      minLines: 1,
                      maxLines: 6,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                      decoration: InputDecoration(
                        hintText: AppCopy.chat.messageHint,
                        filled: true,
                        fillColor: ViroColors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                      ),
                    ),
                  ),
                ),
                IconButton(
                  onPressed: sending ? null : onSend,
                  icon: ViroIcon(
                    ViroIcons.send,
                    color: ViroColors.primary600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
