import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_attach_menu.dart';

/// Bandeau « répondre à » / « modification » + champ de saisie + envoi.
///
/// Le bouton d’envoi reste grisé tant que le champ est vide ; en mode
/// [editing], il enregistre la modification au lieu d’envoyer.
class ChatThreadComposer extends StatelessWidget {
  const ChatThreadComposer({
    super.key,
    required this.controller,
    required this.canPoll,
    required this.replyToSenderName,
    required this.replyPreview,
    required this.showReplyBar,
    required this.onClearReply,
    required this.onSend,
    required this.onCamera,
    required this.onGallery,
    this.editing = false,
    this.onCancelEdit,
    this.onPoll,
    this.focusNode,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final bool canPoll;
  final String replyToSenderName;
  final String replyPreview;
  final bool showReplyBar;
  final VoidCallback onClearReply;
  final VoidCallback onSend;
  final VoidCallback onCamera;
  final VoidCallback onGallery;

  /// Le champ contient le texte d’un message à modifier.
  final bool editing;
  final VoidCallback? onCancelEdit;
  final VoidCallback? onPoll;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (editing)
          _ComposerBanner(
            title: AppCopy.chat.editingMessage,
            closeTooltip: AppCopy.chat.cancelEdit,
            onClose: onCancelEdit ?? () {},
          )
        else if (showReplyBar)
          _ComposerBanner(
            title: '${AppCopy.chat.replyTo} $replyToSenderName',
            preview: replyPreview,
            closeTooltip: AppCopy.chat.cancelReply,
            onClose: onClearReply,
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
              // Champ multiligne : « + » et envoi restent calés en bas.
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                ChatAttachMenu(
                  enabled: !editing,
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
                      // Composition IME en cours : Entrée valide le mot.
                      if (controller.value.composing.isValid) {
                        return KeyEventResult.ignored;
                      }
                      if (controller.text.trim().isNotEmpty) onSend();
                      return KeyEventResult.handled;
                    },
                    child: TextField(
                      controller: controller,
                      focusNode: focusNode,
                      minLines: 1,
                      maxLines: 6,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                      decoration: InputDecoration(
                        hintText: editing
                            ? AppCopy.chat.editMessageHint
                            : AppCopy.chat.messageHint,
                        filled: true,
                        fillColor: palette.surfaceCard,
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
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: controller,
                  builder: (context, value, _) {
                    final canSend = value.text.trim().isNotEmpty;
                    // Pastille pleine comme WhatsApp / Snap : bien visible
                    // dès qu’il y a du texte, adoucie sinon.
                    return Padding(
                      padding: const EdgeInsets.only(left: ViroSpacing.xs),
                      child: IconButton.filled(
                        tooltip: editing
                            ? AppCopy.chat.saveEdit
                            : AppCopy.chat.sendMessage,
                        onPressed: canSend ? onSend : null,
                        style: IconButton.styleFrom(
                          backgroundColor: palette.accentFill,
                          disabledBackgroundColor: palette.accentSofter,
                          minimumSize: const Size.square(
                            ViroSpacing.minTouchTarget,
                          ),
                        ),
                        icon: ViroIcon(
                          editing ? ViroIcons.check : ViroIcons.sendFill,
                          size: 20,
                          color: canSend ? palette.onAccent : palette.accentMid,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Bandeau au-dessus du champ (réponse ou modification) avec bouton fermer.
class _ComposerBanner extends StatelessWidget {
  const _ComposerBanner({
    required this.title,
    required this.closeTooltip,
    required this.onClose,
    this.preview,
  });

  final String title;
  final String? preview;
  final String closeTooltip;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    return Material(
      color: palette.accentSofter,
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
                    title,
                    style: theme.labelSmall?.copyWith(
                      color: palette.accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (preview != null)
                    Text(
                      preview!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodySmall,
                    ),
                ],
              ),
            ),
            IconButton(
              tooltip: closeTooltip,
              onPressed: onClose,
              icon: ViroIcon(ViroIcons.close, color: palette.accent),
            ),
          ],
        ),
      ),
    );
  }
}
