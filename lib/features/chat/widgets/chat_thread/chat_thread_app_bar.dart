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
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Diamètre avatar AppBar (Hero depuis la tuile inbox 44 → 36).
const double _kAppBarAvatarSize = 36;

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
          : Row(
              children: [
                Hero(
                  tag: avatarHeroTag,
                  child: Material(
                    color: Colors.transparent,
                    child: _ThreadAvatar(
                      initial: avatarInitial,
                      color: avatarColor,
                      size: _kAppBarAvatarSize,
                      photoUrl: avatarUrl,
                      isGroup: isGroup,
                      isChannel: isChannel,
                      onEdit: isGroup &&
                              !isChannel &&
                              onChangeAvatar != null &&
                              (conversation?.canEditGroupAvatar ?? false)
                          ? onChangeAvatar
                          : null,
                    ),
                  ),
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
                if (canChangeAvatar)
                  PopupMenuItem(
                    value: 'changeAvatar',
                    child: Row(
                      children: [
                        ViroIcon(
                          ViroIcons.camera,
                          size: 20,
                          color: ViroColors.primary600,
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

/// Pastille avatar AppBar (même look que la tuile inbox).
class _ThreadAvatar extends StatelessWidget {
  const _ThreadAvatar({
    required this.initial,
    required this.color,
    required this.size,
    this.photoUrl,
    this.isGroup = false,
    this.isChannel = false,
    this.onEdit,
  });

  final String initial;
  final Color color;
  final double size;
  final String? photoUrl;
  final bool isGroup;
  final bool isChannel;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final trimmedPhoto = photoUrl?.trim();
    final hasPhoto = trimmedPhoto != null && trimmedPhoto.isNotEmpty;
    final iconSize = size * (20 / 44);

    Widget avatar;
    if (isChannel) {
      avatar = _ThreadIconAvatar(
        size: size,
        background: ViroColors.adminBadgeEnd,
        icon: ViroIcons.megaphone,
        iconSize: iconSize,
      );
    } else if (isGroup && hasPhoto) {
      avatar = ClipOval(
        child: Image.network(
          trimmedPhoto,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _ThreadIconAvatar(
            size: size,
            background: ViroColors.sportGreen,
            icon: ViroIcons.groups,
            iconSize: iconSize,
          ),
        ),
      );
    } else if (isGroup) {
      avatar = _ThreadIconAvatar(
        size: size,
        background: ViroColors.sportGreen,
        icon: ViroIcons.groups,
        iconSize: iconSize,
      );
    } else if (hasPhoto) {
      avatar = ClipOval(
        child: Image.network(
          trimmedPhoto,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _ThreadInitialAvatar(
            initial: initial,
            color: color,
            size: size,
          ),
        ),
      );
    } else {
      avatar = _ThreadInitialAvatar(
        initial: initial,
        color: color,
        size: size,
      );
    }

    if (!hasPhoto) {
      if (onEdit == null) return avatar;
      return GestureDetector(onTap: onEdit, child: avatar);
    }

    return GestureDetector(
      onTap: () {
        showViroImageLightbox(
          context,
          imageUrl: trimmedPhoto,
          onEdit: onEdit,
          shape: ViroImageLightboxShape.circle,
        );
      },
      child: avatar,
    );
  }
}

/// Avatar AppBar avec icône (groupe / canal).
class _ThreadIconAvatar extends StatelessWidget {
  const _ThreadIconAvatar({
    required this.size,
    required this.background,
    required this.icon,
    required this.iconSize,
  });

  final double size;
  final Color background;
  final IconData icon;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        shape: BoxShape.circle,
      ),
      child: ViroIcon(icon, size: iconSize, color: ViroColors.white),
    );
  }
}

/// Initiale circulaire AppBar (fallback DM sans photo).
class _ThreadInitialAvatar extends StatelessWidget {
  const _ThreadInitialAvatar({
    required this.initial,
    required this.color,
    required this.size,
  });

  final String initial;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tint = Color.lerp(Colors.white, color, 0.35)!;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tint,
        shape: BoxShape.circle,
      ),
      child: Text(
        initial,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: size * 0.4,
            ),
      ),
    );
  }
}
