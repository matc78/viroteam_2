import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_poll_bubble.dart';
import 'package:viro_team_v2/features/chat/widgets/create_poll_sheet.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

const _reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

/// Thread d’une conversation.
class ChatThreadScreen extends ConsumerStatefulWidget {
  const ChatThreadScreen({
    super.key,
    required this.clubId,
    required this.conversationId,
  });

  final String clubId;
  final String conversationId;

  @override
  ConsumerState<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends ConsumerState<ChatThreadScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;

  ({String clubId, String conversationId}) get _key => (
        clubId: widget.clubId,
        conversationId: widget.conversationId,
      );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
  }

  Future<void> _markRead() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    await ref.read(chatServiceProvider).markRead(
          uid: uid,
          clubId: widget.clubId,
          conversationId: widget.conversationId,
        );
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendText() async {
    final uid = ref.read(authStateProvider).value?.uid;
    final text = _controller.text;
    if (uid == null || text.trim().isEmpty || _sending) return;
    setState(() => _sending = true);
    _controller.clear();
    try {
      await ref.read(chatServiceProvider).sendTextMessage(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            senderUid: uid,
            text: text,
          );
      await _markRead();
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.chat.sendFailed);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendPhoto() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || _sending) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (file == null) return;
    setState(() => _sending = true);
    try {
      final bytes = await file.readAsBytes();
      await ref.read(chatServiceProvider).sendImageMessage(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            senderUid: uid,
            bytes: Uint8List.fromList(bytes),
          );
      await _markRead();
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.chat.photoFailed);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _openPollSheet() async {
    await showCreatePollSheet(
      context,
      ref: ref,
      clubId: widget.clubId,
      conversationId: widget.conversationId,
    );
  }

  Future<void> _votePoll(ChatMessage message, String optionId) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    try {
      await ref.read(chatServiceProvider).votePollOption(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            messageId: message.id,
            optionId: optionId,
            uid: uid,
          );
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.chat.pollVoteFailed);
      }
    }
  }

  Future<void> _toggleMute(ChatUserState? state) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    final muted = !(state?.muted ?? false);
    await ref.read(chatServiceProvider).setMuted(
          uid: uid,
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          muted: muted,
        );
  }

  Future<void> _rename(ChatConversation conv) async {
    final controller = TextEditingController(text: conv.displayTitle);
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
    if (ok != true) return;
    await ref.read(chatServiceProvider).renameConversation(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          titleOverride: controller.text,
        );
  }

  Future<void> _deleteMessage(ChatMessage message) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
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
    if (ok != true) return;
    await ref.read(chatServiceProvider).softDeleteMessage(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          messageId: message.id,
          deletedByUid: uid,
        );
  }

  Future<void> _react(ChatMessage message, String emoji) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    await ref.read(chatServiceProvider).toggleReaction(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          messageId: message.id,
          emoji: emoji,
          uid: uid,
        );
  }

  void _showMessageActions(ChatMessage message) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(ViroSpacing.sm),
              child: Wrap(
                spacing: 8,
                children: _reactionEmojis
                    .map(
                      (emoji) => InkWell(
                        onTap: () {
                          Navigator.pop(ctx);
                          _react(message, emoji);
                        },
                        child: Text(emoji, style: const TextStyle(fontSize: 28)),
                      ),
                    )
                    .toList(),
              ),
            ),
            ListTile(
              leading: ViroIcon(ViroIcons.trash),
              title: Text(AppCopy.chat.deleteMessage),
              onTap: () {
                Navigator.pop(ctx);
                _deleteMessage(message);
              },
            ),
          ],
        ),
      ),
    );
  }

  bool _canWrite(ChatConversation? conv, String? uid, String? role) {
    if (conv == null || uid == null) return false;
    if (!conv.participantUids.contains(uid)) return false;
    switch (conv.writePolicy) {
      case ChatWritePolicies.adminsOnly:
        return role == MemberRoles.admin;
      case ChatWritePolicies.coachesAndAdmins:
        return role == MemberRoles.admin || role == MemberRoles.coach;
      default:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authStateProvider).value?.uid;
    // Tant que le fil est ouvert, chaque arrivée de message remet unread à 0
    // (et rafraîchit lastReadAt pour le trigger push).
    ref.listen(chatMessagesProvider(_key), (previous, next) {
      final messages = next.asData?.value;
      if (messages == null) return;
      final prevMessages = previous?.asData?.value;
      final prevLastId = (prevMessages == null || prevMessages.isEmpty)
          ? null
          : prevMessages.last.id;
      final lastId = messages.isEmpty ? null : messages.last.id;
      if (lastId == null || lastId == prevLastId) return;
      _markRead();
    });
    final clubs = ref.watch(userClubsProvider).value ?? const [];
    final membership = clubs
        .where((e) => e.club.id == widget.clubId)
        .map((e) => e.membership)
        .firstOrNull;
    final role = membership?.role;
    final convAsync = ref.watch(chatConversationProvider(_key));
    final messagesAsync = ref.watch(chatMessagesProvider(_key));
    final states = ref.watch(chatStatesProvider).value ?? const {};
    final stateId = ChatUserState.docId(widget.clubId, widget.conversationId);
    final state = states[stateId];
    final conv = convAsync.value;
    final title = conv?.displayTitle ?? AppCopy.chat.conversationsTitle;
    final isAdminOnly = conv?.writePolicy == ChatWritePolicies.adminsOnly;
    final canWrite = _canWrite(conv, uid, role);
    final canPoll = canWrite && (conv?.participantUids.length ?? 0) > 2;

    return ViroScaffold(
      appBar: ViroAppBar(
        title: Text(title),
        actions: [
          if (isAdminOnly)
            IconButton(
              tooltip: AppCopy.chat.makeAnnouncement,
              icon: ViroIcon(ViroIcons.megaphone, color: ViroColors.primary600),
              onPressed: () => context.push(
                AppRoutes.clubAnnouncementsPath(widget.clubId),
              ),
            ),
          PopupMenuButton<String>(
            onSelected: (value) {
              switch (value) {
                case 'rename':
                  if (conv != null) _rename(conv);
                case 'mute':
                  _toggleMute(state);
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'rename',
                child: Text(AppCopy.chat.renameConversation),
              ),
              PopupMenuItem(
                value: 'mute',
                child: Text(
                  (state?.muted ?? false)
                      ? AppCopy.chat.unmute
                      : AppCopy.chat.mute,
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (isAdminOnly)
            Material(
              color: ViroColors.primary50,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.screenHorizontal,
                  vertical: ViroSpacing.xs,
                ),
                child: Text(
                  AppCopy.chat.readonlyHint,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.primary600,
                      ),
                ),
              ),
            ),
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(child: Text(AppCopy.chat.loadError)),
              data: (messages) {
                if (messages.isEmpty) {
                  return const SizedBox.shrink();
                }
                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.screenHorizontal,
                    vertical: ViroSpacing.sm,
                  ),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[index];
                    final mine = message.senderUid == uid;
                    if (message.isPoll && !message.isDeleted) {
                      return ChatPollBubble(
                        message: message,
                        mine: mine,
                        viewerUid: uid,
                        onVote: (optionId) => _votePoll(message, optionId),
                        onLongPress: () => _showMessageActions(message),
                      );
                    }
                    return _MessageBubble(
                      message: message,
                      mine: mine,
                      onLongPress: () => _showMessageActions(message),
                    );
                  },
                );
              },
            ),
          ),
          if (canWrite)
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
                    IconButton(
                      onPressed: _sending ? null : _sendPhoto,
                      icon: ViroIcon(
                        ViroIcons.image,
                        color: ViroColors.primary600,
                      ),
                    ),
                    if (canPoll)
                      IconButton(
                        tooltip: AppCopy.chat.createPoll,
                        onPressed: _sending ? null : _openPollSheet,
                        icon: ViroIcon(
                          ViroIcons.poll,
                          color: ViroColors.primary600,
                        ),
                      ),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _sendText(),
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
                    IconButton(
                      onPressed: _sending ? null : _sendText,
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
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.mine,
    required this.onLongPress,
  });

  final ChatMessage message;
  final bool mine;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final align = mine ? Alignment.centerRight : Alignment.centerLeft;
    final bg = mine ? ViroColors.primary600 : ViroColors.white;
    final fg = mine ? ViroColors.white : ViroColors.primary800;

    if (message.isDeleted) {
      return Align(
        alignment: align,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(
            AppCopy.chat.messageDeleted,
            style: theme.bodySmall?.copyWith(
              fontStyle: FontStyle.italic,
              color: ViroColors.gray400,
            ),
          ),
        ),
      );
    }

    final reactionChips = message.reactions.entries
        .where((e) => e.value.isNotEmpty)
        .map((e) => '${e.key} ${e.value.length}')
        .join('  ');

    return Align(
      alignment: align,
      child: GestureDetector(
        onLongPress: onLongPress,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.78,
          ),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: mine
                ? null
                : Border.all(color: ViroColors.primary100),
          ),
          child: Column(
            crossAxisAlignment:
                mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              if (message.type == ChatMessageTypes.image &&
                  (message.downloadUrl ?? '').isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    message.downloadUrl!,
                    fit: BoxFit.cover,
                    width: 220,
                  ),
                )
              else
                Text(
                  message.text ?? '',
                  style: theme.bodyMedium?.copyWith(color: fg),
                ),
              if (reactionChips.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  reactionChips,
                  style: theme.labelSmall?.copyWith(
                    color: mine ? ViroColors.primary100 : ViroColors.gray600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
