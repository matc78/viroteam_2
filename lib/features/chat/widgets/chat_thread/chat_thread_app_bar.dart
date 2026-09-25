import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_day_separator.dart';
import 'package:viro_team_v2/features/chat/widgets/conversation_info_sheet.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// AppBar du fil : titre / recherche + actions (info, annonces, menu).
class ChatThreadAppBar extends StatelessWidget implements PreferredSizeWidget {
  const ChatThreadAppBar({
    super.key,
    required this.title,
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
  });

  final String title;
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
      onOpenImage: (url) => showChatImageLightbox(context, imageUrl: url),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ViroAppBar(
      title: searchOpen
          ? TextField(
              controller: searchController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: AppCopy.chat.searchMessagesHint,
                border: InputBorder.none,
                hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: ViroColors.gray400,
                    ),
              ),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: ViroColors.primary800,
                  ),
            )
          : Text(title),
      actions: [
        IconButton(
          tooltip: searchOpen
              ? AppCopy.common.cancel
              : AppCopy.chat.searchMessagesHint,
          icon: ViroIcon(
            searchOpen ? ViroIcons.close : ViroIcons.search,
            color: ViroColors.primary600,
          ),
          onPressed: onToggleSearch,
        ),
        if (!searchOpen && conversation != null)
          IconButton(
            tooltip: AppCopy.chat.conversationInfo,
            icon: ViroIcon(ViroIcons.info, color: ViroColors.primary600),
            onPressed: () => _openInfo(context),
          ),
        if (isAdminOnly)
          IconButton(
            tooltip: AppCopy.chat.makeAnnouncement,
            icon: ViroIcon(ViroIcons.megaphone, color: ViroColors.primary600),
            onPressed: () => context.push(
              AppRoutes.clubAnnouncementsPath(clubId),
            ),
          ),
        if (!searchOpen)
          PopupMenuButton<String>(
            icon: ViroIcon(
              ViroIcons.moreVertical,
              color: ViroColors.primary600,
            ),
            onSelected: (value) {
              switch (value) {
                case 'rename':
                  onRename();
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
              return [
                PopupMenuItem(
                  value: 'info',
                  child: Row(
                    children: [
                      ViroIcon(
                        ViroIcons.info,
                        size: 20,
                        color: ViroColors.primary600,
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
                        color: ViroColors.primary600,
                      ),
                      const SizedBox(width: ViroSpacing.sm),
                      Text(AppCopy.chat.renameConversation),
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
                        color: ViroColors.primary600,
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
                        color: ViroColors.primary600,
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
