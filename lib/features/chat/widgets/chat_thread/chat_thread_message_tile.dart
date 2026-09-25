import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/screens/poll_votes_screen.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_day_separator.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_poll_bubble.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_message_bubble.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_reaction_emojis.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Une ligne du fil : séparateurs + bulle (texte/image/sondage) + avatar groupe.
class ChatThreadMessageTile extends StatelessWidget {
  const ChatThreadMessageTile({
    super.key,
    required this.message,
    required this.previousCreatedAt,
    required this.mine,
    required this.viewerUid,
    required this.isGroup,
    required this.members,
    required this.nameByUid,
    required this.memberByUid,
    required this.anchorKey,
    required this.messageAnchorKeys,
    required this.showUnreadSeparator,
    required this.searchOpen,
    required this.searchQuery,
    required this.clubId,
    required this.conversationId,
    required this.participantCount,
    required this.reactorsMessageId,
    required this.onShowActions,
    required this.onReact,
    required this.onOpenReactors,
    required this.onDismissReactors,
    required this.onVotePoll,
  });

  final ChatMessage message;
  final DateTime? previousCreatedAt;
  final bool mine;
  final String? viewerUid;
  final bool isGroup;
  final List<ClubMember> members;
  final Map<String, String> nameByUid;
  final Map<String, ClubMember> memberByUid;
  final GlobalKey anchorKey;
  final Map<String, GlobalKey> messageAnchorKeys;
  final bool showUnreadSeparator;
  final bool searchOpen;
  final String searchQuery;
  final String clubId;
  final String conversationId;
  final int participantCount;
  final String? reactorsMessageId;
  final void Function(ChatMessage message, {required bool mine}) onShowActions;
  final void Function(ChatMessage message, String emoji) onReact;
  final void Function({
    required ChatMessage message,
    required String? viewerUid,
    required Map<String, String> nameByUid,
    required Map<String, ClubMember> memberByUid,
  }) onOpenReactors;
  final VoidCallback onDismissReactors;
  final void Function(ChatMessage message, String optionId) onVotePoll;

  @override
  Widget build(BuildContext context) {
    final query = searchQuery.toLowerCase();
    final borderColor = chatBubbleBorderForRole(
      chatThreadSenderRoleFor(message.senderUid, members),
    );
    final showDaySeparator = previousCreatedAt == null ||
        !chatThreadSameCalendarDay(previousCreatedAt!, message.createdAt);
    final matchesSearch = query.isEmpty ||
        (message.text ?? '').toLowerCase().contains(query) ||
        (message.pollQuestion ?? '').toLowerCase().contains(query);
    final showSenderMeta = !mine && isGroup;
    final senderLabel = showSenderMeta
        ? chatThreadSenderFullName(message.senderUid, members)
        : '';
    final senderMember =
        showSenderMeta ? memberByUid[message.senderUid] : null;
    final replySenderLabel = message.replyToSenderUid == null
        ? ''
        : chatThreadSenderFirstName(message.replyToSenderUid!, members);
    final isPollBubble = message.isPoll && !message.isDeleted;
    final hasReactionChips = !isPollBubble &&
        !message.isDeleted &&
        message.reactions.values.any((uids) => uids.isNotEmpty);
    const senderAvatarSize = 28.0;
    final avatarBottomPad = hasReactionChips ? 20.0 : 4.0;

    late final Widget bubble;
    if (isPollBubble) {
      bubble = KeyedSubtree(
        key: anchorKey,
        child: ChatPollBubble(
          message: message,
          mine: mine,
          viewerUid: viewerUid,
          memberByUid: memberByUid,
          borderColor: borderColor,
          senderLabel: senderLabel,
          onVote: (optionId) => onVotePoll(message, optionId),
          onLongPress: () => onShowActions(message, mine: mine),
          onViewVotes: () => openPollVotesScreen(
            context: context,
            clubId: clubId,
            conversationId: conversationId,
            messageId: message.id,
            participantCount: participantCount,
          ),
        ),
      );
    } else {
      bubble = ChatMessageBubble(
        anchorKey: anchorKey,
        message: message,
        mine: mine,
        viewerUid: viewerUid,
        borderColor: borderColor,
        senderLabel: senderLabel,
        replySenderLabel: replySenderLabel,
        highlightQuery: query.isEmpty ? null : searchQuery,
        isSearchMatch: searchOpen && query.isNotEmpty && matchesSearch,
        onLongPress: () => onShowActions(message, mine: mine),
        onDoubleTap: () => onReact(message, chatHeartReactionEmoji),
        onOpenReactors: () {
          if (reactorsMessageId == message.id) {
            onDismissReactors();
            return;
          }
          onOpenReactors(
            message: message,
            viewerUid: viewerUid,
            nameByUid: nameByUid,
            memberByUid: memberByUid,
          );
        },
        onImageTap: () {
          final url = message.downloadUrl ?? message.thumbUrl;
          if (url == null || url.isEmpty) return;
          showChatImageLightbox(context, imageUrl: url);
        },
        onReplyTap: message.hasReply
            ? () {
                final targetId = message.replyToMessageId;
                if (targetId == null) return;
                final key = messageAnchorKeys[targetId];
                final ctx = key?.currentContext;
                if (ctx != null) {
                  Scrollable.ensureVisible(
                    ctx,
                    duration: ViroMotion.fast,
                    alignment: 0.3,
                  );
                }
              }
            : null,
      );
    }

    final messageRow = showSenderMeta
        ? Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Padding(
                padding: EdgeInsets.only(
                  right: ViroSpacing.xs,
                  bottom: avatarBottomPad,
                ),
                child: senderMember != null
                    ? MemberAvatar(
                        member: senderMember,
                        size: senderAvatarSize,
                      )
                    : const SizedBox(
                        width: senderAvatarSize,
                        height: senderAvatarSize,
                      ),
              ),
              Flexible(child: bubble),
            ],
          )
        : bubble;

    return KeyedSubtree(
      key: ValueKey(message.id),
      child: Opacity(
        opacity: (searchOpen && query.isNotEmpty && !matchesSearch) ? 0.35 : 1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showDaySeparator)
              ChatDaySeparator(
                label: formatChatDaySeparator(message.createdAt),
              ),
            if (showUnreadSeparator)
              ChatUnreadSeparator(
                label: AppCopy.chat.unreadSeparatorLabel,
              ),
            messageRow,
          ],
        ),
      ),
    );
  }
}
