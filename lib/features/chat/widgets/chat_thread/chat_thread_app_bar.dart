import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/chat_group_avatar_style.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_day_separator.dart';
import 'package:viro_team_v2/features/chat/widgets/conversation_info_sheet.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_conversation_avatar.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// AppBar du fil : titre / recherche + actions (info, annonces, menu).
class ChatThreadAppBar extends StatelessWidget implements PreferredSizeWidget {
  const ChatThreadAppBar({
    super.key,
    required this.title,
    required this.avatarInitial,
    required this.avatarColor,
    required this.avatarHeroTag,
    this.avatarUrl,
    this.isGroup = false,
    this.isChannel = false,
    required this.searchOpen,
    required this.searchController,
    required this.isAdminOnly,
    required this.clubId,
    required this.conversation,
    required this.state,
    required this.members,
    required this.mergedMessages,
    required this.onToggleSearch,
    required this.onToggleMute,
    required this.onToggleFavorite,
    required this.onRename,
    this.onChangeAvatar,
  });

  final String title;
  final String avatarInitial;
  final Color avatarColor;
  final String avatarHeroTag;

  /// Photo (pair DM ou avatar groupe) — sinon pastille / icône type.
  final String? avatarUrl;

  /// Même chrome que la tuile inbox (icône groupe vert / canal violet).
  final bool isGroup;
  final bool isChannel;
  final bool searchOpen;
  final TextEditingController searchController;
  final bool isAdminOnly;
  final String clubId;
  final ChatConversation? conversation;
  final ChatUserState? state;
  final List<ClubMember> members;
  final List<ChatMessage> mergedMessages;
  final VoidCallback onToggleSearch;
  final VoidCallback onToggleMute;
  final VoidCallback onToggleFavorite;
  final VoidCallback onRename;
  final VoidCallback? onChangeAvatar;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  void _openInfo(BuildContext context) {
    final conv = conversation;
    if (conv == null) return;
    showConversationInfoSheet(
      context: context,
      conversation: conv,
      state: state,
      members: members,
      messages: mergedMessages,
      onToggleMute: onToggleMute,
      onToggleFavorite: onToggleFavorite,
      onRename: onRename,
      onChangeAvatar: onChangeAvatar,
      onOpenImage: (url) => showChatImageLightbox(context, imageUrl: url),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final conv = conversation;
    final groupBackground = conv != null
        ? colorForConversationGroupAvatarTone(
            conv.groupAvatarTone,
            palette: palette,
          )
        : colorForConversationGroupAvatarTone(
            isChannel
                ? ConversationGroupAvatarTone.channel
                : ConversationGroupAvatarTone.group,
            palette: palette,
          );

    return ViroAppBar(
      fallbackRoute: AppRoutes.conversations,
      title: searchOpen
          ? TextField(
              controller: searchController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: AppCopy.chat.searchMessagesHint,
                border: InputBorder.none,
                hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: palette.textMuted,
                    ),
              ),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: palette.brandText,
                  ),
            )
          : Row(
              children: [
                ViroConversationAvatar(
                  heroTag: avatarHeroTag,
                  initial: avatarInitial,
                  color: avatarColor,
                  size: ViroChat.avatarHeader,
                  photoUrl: avatarUrl,
                  isGroup: isGroup,
                  isChannel: isChannel,
                  groupBackground: groupBackground,
                  semanticLabel: !isChannel &&
                          (avatarUrl?.trim().isNotEmpty ?? false)
                      ? AppCopy.chat.viewConversationPhoto
                      : AppCopy.chat.changeGroupAvatar,
                  onEdit: isGroup &&
                          !isChannel &&
                          onChangeAvatar != null &&
                          (conv?.canEditGroupAvatar ?? false)
                      ? onChangeAvatar
                      : null,
                ),
                const SizedBox(width: ViroSpacing.sm),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
      actions: [
        IconButton(
          tooltip: searchOpen
              ? AppCopy.common.cancel
              : AppCopy.chat.searchMessagesHint,
          icon: ViroIcon(
            searchOpen ? ViroIcons.close : ViroIcons.search,
            color: palette.accent,
          ),
          onPressed: onToggleSearch,
        ),
        if (!searchOpen && conversation != null)
          IconButton(
            tooltip: AppCopy.chat.conversationInfo,
            icon: ViroIcon(ViroIcons.info, color: palette.accent),
            onPressed: () => _openInfo(context),
          ),
        if (isAdminOnly)
          IconButton(
            tooltip: AppCopy.chat.makeAnnouncement,
            icon: ViroIcon(ViroIcons.megaphone, color: palette.accent),
            onPressed: () => context.push(
              AppRoutes.clubAnnouncementsPath(clubId),
            ),
          ),
        if (!searchOpen)
          PopupMenuButton<String>(
            tooltip: AppCopy.chat.threadMenu,
            icon: ViroIcon(
              ViroIcons.moreVertical,
              color: palette.accent,
            ),
            onSelected: (value) {
              switch (value) {
                case 'rename':
                  onRename();
                case 'changeAvatar':
                  onChangeAvatar?.call();
                case 'mute':
                  onToggleMute();
                case 'favorite':
                  onToggleFavorite();
                case 'info':
                  _openInfo(context);
              }
            },
            itemBuilder: (_) {
              final isMuted = state?.muted ?? false;
              final isFavorite = state?.favorite ?? false;
              final canChangeAvatar = onChangeAvatar != null &&
                  (conversation?.canEditGroupAvatar ?? false);
              return [
                PopupMenuItem(
                  value: 'info',
                  child: Row(
                    children: [
                      ViroIcon(
                        ViroIcons.info,
                        size: 20,
                        color: palette.accent,
                      ),
                      const SizedBox(width: ViroSpacing.sm),
                      Text(AppCopy.chat.conversationInfo),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: 'rename',
                  child: Row(
                    children: [
                      ViroIcon(
                        ViroIcons.edit,
                        size: 20,
                        color: palette.accent,
                      ),
                      const SizedBox(width: ViroSpacing.sm),
                      Text(AppCopy.chat.renameConversation),
                    ],
                  ),
                ),
                if (canChangeAvatar)
                  PopupMenuItem(
                    value: 'changeAvatar',
                    child: Row(
                      children: [
                        ViroIcon(
                          ViroIcons.camera,
                          size: 20,
                          color: palette.accent,
                        ),
                        const SizedBox(width: ViroSpacing.sm),
                        Text(AppCopy.chat.changeGroupAvatar),
                      ],
                    ),
                  ),
                PopupMenuItem(
                  value: 'favorite',
                  child: Row(
                    children: [
                      ViroIcon(
                        isFavorite
                            ? ViroIcons.favoriteFill
                            : ViroIcons.favorite,
                        size: 20,
                        color: palette.accent,
                      ),
                      const SizedBox(width: ViroSpacing.sm),
                      Text(
                        isFavorite
                            ? AppCopy.chat.removeFavorite
                            : AppCopy.chat.addFavorite,
                      ),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: 'mute',
                  child: Row(
                    children: [
                      ViroIcon(
                        isMuted ? ViroIcons.bell : ViroIcons.mute,
                        size: 20,
                        color: palette.accent,
                      ),
                      const SizedBox(width: ViroSpacing.sm),
                      Text(
                        isMuted ? AppCopy.chat.unmute : AppCopy.chat.mute,
                      ),
                    ],
                  ),
                ),
              ];
            },
          ),
      ],
    );
  }
}
