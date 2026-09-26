import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/chat_thread_open_seed.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/club_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Diamètre de l’avatar inbox (pastille initiale / icône groupe-canal).
const double _kAvatarSize = 44;

/// Tuile inbox style messagerie : avatar, titre + horodatage, badges, preview.
///
/// Ligne 1 : titre (large) + timestamp à droite ; ligne 2 : chips club/rôle ;
/// ligne 3 : preview (+ badge non-lus). Avatar groupe vert / canal violet.
class ConversationListTile extends StatelessWidget {
  const ConversationListTile({
    super.key,
    required this.conversation,
    required this.clubName,
    required this.clubColor,
    required this.onTap,
    this.state,
    this.clubRole,
    this.previewFirstName,
    this.previewSenderRole,
    this.peerDisplayName,
    this.peerAvatarUrl,
    this.viewerUid,
    this.showDivider = true,
  });

  final ChatConversation conversation;
  final String clubName;
  final Color clubColor;
  final VoidCallback onTap;
  final ChatUserState? state;

  /// Rôle de l’utilisateur courant dans le club (badge meta).
  final ViroRole? clubRole;

  /// Prénom de l’auteur du dernier message (annuaire, fallback).
  final String? previewFirstName;

  /// Rôle de l’auteur (`player` | `coach` | `admin` | `parent`).
  final String? previewSenderRole;

  /// Nom du pair pour un DM (évite d’afficher son propre nom).
  final String? peerDisplayName;

  /// Photo du pair pour un DM 1:1 (sinon initiale).
  final String? peerAvatarUrl;

  /// UID du viewer (exclut ses propres messages du fallback non-lus).
  final String? viewerUid;

  /// Trait sous la tuile, aligné sous le texte (pas sous l’avatar).
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final unread = _effectiveUnreadCount(
      conversation: conversation,
      state: state,
      viewerUid: viewerUid,
    );
    final muted = state?.muted ?? false;
    final favorite = state?.favorite ?? false;
    final preview = conversation.lastMessagePreview.trim();
    // Persisté d’abord (comme le portail), puis annuaire.
    final firstName =
        (conversation.lastSenderFirstName ?? previewFirstName ?? '').trim();
    final hasUnread = unread > 0;
    final isGroup = conversation.isGroup;
    final isChannel = conversation.isReadonlyForMembers;
    final showSenderInPreview = isGroup && firstName.isNotEmpty && !hasUnread;
    final previewColor =
        hasUnread ? ViroColors.gray600 : ViroColors.gray400;
    final previewStyle = theme.bodySmall?.copyWith(
      color: previewColor,
      fontWeight: hasUnread ? FontWeight.w600 : FontWeight.w400,
      fontSize: 13,
      fontStyle: FontStyle.italic,
    );
    final nameStyle = theme.bodySmall?.copyWith(
      color: previewColor,
      fontWeight: FontWeight.w600,
      fontSize: 13,
      fontStyle: FontStyle.normal,
    );
    final timestamp = conversation.lastMessageAt;
    final title = conversation.displayTitle(peerDisplayName: peerDisplayName);
    final initial = _avatarInitial(title);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ViroPressable(
          onTap: onTap,
          floating: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.sm + 2,
              ViroSpacing.screenHorizontal,
              ViroSpacing.sm + 2,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ConversationAvatar(
                  initial: initial,
                  color: clubColor,
                  isGroup: isGroup,
                  isChannel: isChannel,
                  photoUrl: isGroup
                      ? conversation.avatarUrl
                      : peerAvatarUrl,
                  heroTag: ChatThreadOpenSeed.avatarHeroTag(
                    conversation.clubId,
                    conversation.id,
                  ),
                ),
                const SizedBox(width: ViroSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (favorite) ...[
                            ViroIcon(
                              ViroIcons.favoriteFill,
                              size: 12,
                              color: ViroColors.error,
                            ),
                            const SizedBox(width: 4),
                          ],
                          Expanded(
                            child: Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.titleSmall?.copyWith(
                                fontSize: 16,
                                fontWeight: hasUnread
                                    ? FontWeight.w800
                                    : FontWeight.w700,
                                color: ViroColors.primary800,
                              ),
                            ),
                          ),
                          if (timestamp != null) ...[
                            const SizedBox(width: ViroSpacing.sm),
                            Text(
                              formatChatInboxTimestamp(timestamp),
                              style: theme.labelSmall?.copyWith(
                                color: ViroColors.gray400,
                                fontWeight: hasUnread
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Flexible(
                            child: ClubChip(
                              label: clubName,
                              color: clubColor,
                              filled: true,
                            ),
                          ),
                          if (clubRole != null) ...[
                            const SizedBox(width: 6),
                            ViroRoleBadge(
                              role: clubRole!,
                              compact: true,
                              iconOnly: true,
                            ),
                          ],
                          if (muted) ...[
                            const SizedBox(width: 6),
                            ViroIcon(
                              ViroIcons.mute,
                              size: 12,
                              color: ViroColors.primary600,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: _FadingPreviewLine(
                              child: hasUnread
                                  ? Text(
                                      AppCopy.chat.unreadPreview(unread),
                                      maxLines: 1,
                                      softWrap: false,
                                      overflow: TextOverflow.clip,
                                      style: previewStyle?.copyWith(
                                        fontStyle: FontStyle.normal,
                                      ),
                                    )
                                  : preview.isEmpty
                                      ? Text(
                                          AppCopy.chat.emptyPreview,
                                          maxLines: 1,
                                          softWrap: false,
                                          overflow: TextOverflow.clip,
                                          style: previewStyle,
                                        )
                                      : showSenderInPreview
                                          ? Row(
                                              children: [
                                                Text(
                                                  firstName,
                                                  maxLines: 1,
                                                  softWrap: false,
                                                  overflow: TextOverflow.clip,
                                                  style: nameStyle,
                                                ),
                                                const SizedBox(width: 4),
                                                _PreviewArrow(
                                                  color: previewColor,
                                                ),
                                                const SizedBox(width: 4),
                                                Expanded(
                                                  child: Text(
                                                    preview,
                                                    maxLines: 1,
                                                    softWrap: false,
                                                    overflow:
                                                        TextOverflow.clip,
                                                    style: previewStyle,
                                                  ),
                                                ),
                                              ],
                                            )
                                          : Text(
                                              preview,
                                              maxLines: 1,
                                              softWrap: false,
                                              overflow: TextOverflow.clip,
                                              style: previewStyle,
                                            ),
                            ),
                          ),
                          if (hasUnread) ...[
                            const SizedBox(width: ViroSpacing.sm),
                            _UnreadBadge(count: unread),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (showDivider)
          const Divider(
            height: 1,
            thickness: 1,
            indent: ViroSpacing.screenHorizontal + _kAvatarSize + ViroSpacing.md,
            color: ViroColors.gray200,
          ),
      ],
    );
  }
}

/// Compteur non-lus affiché : `unreadCount` Firestore, sinon fallback
/// dernier message d’un autre jamais lu / après `lastReadAt`.
int _effectiveUnreadCount({
  required ChatConversation conversation,
  required ChatUserState? state,
  required String? viewerUid,
}) {
  if (state?.muted == true) return 0;
  if (state != null && state.unreadCount > 0) return state.unreadCount;
  final lastAt = conversation.lastMessageAt;
  final lastSender = conversation.lastSenderUid?.trim() ?? '';
  if (lastAt == null || lastSender.isEmpty) return 0;
  if (viewerUid != null && lastSender == viewerUid) return 0;
  final readAt = state?.lastReadAt;
  if (readAt == null) return 1;
  if (lastAt.isAfter(readAt)) return 1;
  return 0;
}

/// Initiale affichée dans l’avatar (première lettre significative du titre).
String _avatarInitial(String title) {
  final trimmed = title.trim();
  if (trimmed.isEmpty) return '?';
  return trimmed.substring(0, 1).toUpperCase();
}

/// Flèche courte dans une pastille grise (séparateur preview groupe).
class _PreviewArrow extends StatelessWidget {
  const _PreviewArrow({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 16,
      height: 16,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: ViroColors.gray100,
        shape: BoxShape.circle,
      ),
      child: ViroIcon(
        ViroIcons.chevronRight,
        size: 10,
        color: color,
      ),
    );
  }
}

/// Avatar circulaire : DM (photo ou initiale marque), groupe (users vert),
/// canal (mégaphone violet).
class _ConversationAvatar extends StatelessWidget {
  const _ConversationAvatar({
    required this.initial,
    required this.color,
    required this.isGroup,
    required this.isChannel,
    required this.heroTag,
    this.photoUrl,
  });

  final String initial;
  final Color color;
  final bool isGroup;
  final bool isChannel;
  final String heroTag;
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    late final Color background;
    late final Color foreground;
    late final Widget child;

    final trimmedPhoto = photoUrl?.trim();
    final hasPhoto = trimmedPhoto != null && trimmedPhoto.isNotEmpty;
    final hasDmPhoto = !isGroup && !isChannel && hasPhoto;
    final hasGroupPhoto = isGroup && !isChannel && hasPhoto;

    if (isChannel) {
      background = ViroColors.adminBadgeEnd;
      foreground = ViroColors.white;
      child = ViroIcon(ViroIcons.megaphone, size: 20, color: foreground);
    } else if (hasGroupPhoto) {
      background = Colors.transparent;
      foreground = ViroColors.white;
      child = ClipOval(
        child: Image.network(
          trimmedPhoto,
          width: _kAvatarSize,
          height: _kAvatarSize,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: _kAvatarSize,
            height: _kAvatarSize,
            alignment: Alignment.center,
            color: ViroColors.sportGreen,
            child: ViroIcon(ViroIcons.groups, size: 20, color: ViroColors.white),
          ),
        ),
      );
    } else if (isGroup) {
      background = ViroColors.sportGreen;
      foreground = ViroColors.white;
      child = ViroIcon(ViroIcons.groups, size: 20, color: foreground);
    } else if (hasDmPhoto) {
      background = Colors.transparent;
      foreground = color;
      child = ClipOval(
        child: Image.network(
          trimmedPhoto,
          width: _kAvatarSize,
          height: _kAvatarSize,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _DmInitial(
            initial: initial,
            color: color,
            size: _kAvatarSize,
          ),
        ),
      );
    } else {
      background = Color.lerp(Colors.white, color, 0.35)!;
      foreground = color;
      child = Text(
        initial,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: foreground,
              fontWeight: FontWeight.w800,
            ),
      );
    }

    final avatar = Hero(
      tag: heroTag,
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: _kAvatarSize,
          height: _kAvatarSize,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            shape: BoxShape.circle,
          ),
          clipBehavior: (hasDmPhoto || hasGroupPhoto) ? Clip.antiAlias : Clip.none,
          child: child,
        ),
      ),
    );

    if (!hasDmPhoto && !hasGroupPhoto) return avatar;

    return GestureDetector(
      onTap: () {
        showViroImageLightbox(
          context,
          imageUrl: trimmedPhoto,
          shape: ViroImageLightboxShape.circle,
        );
      },
      child: avatar,
    );
  }
}

/// Initiale DM (fallback si la photo réseau échoue).
class _DmInitial extends StatelessWidget {
  const _DmInitial({
    required this.initial,
    required this.color,
    required this.size,
  });

  final String initial;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final background = Color.lerp(Colors.white, color, 0.35)!;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: background,
      child: Text(
        initial,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

/// Compteur de non-lus (colonne droite, comme le portail).
class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 20),
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: const BoxDecoration(
        color: ViroColors.primary600,
        borderRadius: BorderRadius.all(Radius.circular(10)),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: ViroColors.white,
              fontWeight: FontWeight.w800,
              fontSize: 10,
            ),
      ),
    );
  }
}

/// Preview inbox tronquée avec fondu à droite (pas de « … »).
class _FadingPreviewLine extends StatelessWidget {
  const _FadingPreviewLine({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        return ShaderMask(
          blendMode: BlendMode.dstIn,
          shaderCallback: (bounds) {
            final fadeStart = ((maxWidth - 36) / maxWidth).clamp(0.0, 1.0);
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: const [
                Color(0xFF000000),
                Color(0xFF000000),
                Color(0x00000000),
              ],
              stops: [0.0, fadeStart, 1.0],
            ).createShader(Offset.zero & Size(maxWidth, bounds.height));
          },
          child: SizedBox(
            width: maxWidth,
            child: child,
          ),
        );
      },
    );
  }
}
