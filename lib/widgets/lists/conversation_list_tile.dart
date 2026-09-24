import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/club_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Diamètre de l’avatar inbox (pastille initiale / couleur club).
const double _kAvatarSize = 44;

/// Indent du séparateur : padding + avatar + gap (ne passe pas sous l’avatar).
const double _kDividerIndent =
    ViroSpacing.screenHorizontal + _kAvatarSize + ViroSpacing.md;

/// Tuile inbox style messagerie : avatar, badges club/rôle, preview, horodatage.
///
/// Alignée sur le portail (`ConversationListItem`) : pastille club marque,
/// badge rôle viewer, preview `Prénom → texte` ou « X nouveau message » si non lus.
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
    this.viewerUid,
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

  /// UID du viewer (exclut ses propres messages du fallback non-lus).
  final String? viewerUid;

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
    final firstName = (conversation.lastSenderFirstName ?? previewFirstName ?? '')
        .trim();
    final role = (conversation.lastSenderRole ?? previewSenderRole ?? '').trim();
    final arrowColor = chatBubbleBorderForRole(role.isEmpty ? 'player' : role);
    final hasUnread = unread > 0;
    final previewStyle = theme.bodySmall?.copyWith(
      color: hasUnread ? ViroColors.primary800 : ViroColors.gray600,
      fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w400,
      fontSize: 13,
    );
    final timestamp = conversation.lastMessageAt;
    final title = conversation.displayTitle(peerDisplayName: peerDisplayName);
    final initial = _avatarInitial(title);

    return ViroPressable(
      onTap: onTap,
      floating: false,
      child: ColoredBox(
        color: hasUnread
            ? ViroColors.primary50.withValues(alpha: 0.65)
            : Colors.transparent,
        child: Column(
          children: [
            Padding(
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
                                  color: hasUnread
                                      ? ViroColors.primary600
                                      : ViroColors.gray400,
                                  fontWeight: hasUnread
                                      ? FontWeight.w700
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
                        _FadingPreviewLine(
                          child: hasUnread
                              ? Text(
                                  AppCopy.chat.unreadPreview(unread),
                                  maxLines: 1,
                                  softWrap: false,
                                  overflow: TextOverflow.clip,
                                  style: previewStyle,
                                )
                              : preview.isEmpty
                                  ? Text(
                                      AppCopy.chat.emptyPreview,
                                      maxLines: 1,
                                      softWrap: false,
                                      overflow: TextOverflow.clip,
                                      style: previewStyle,
                                    )
                                  : firstName.isEmpty
                                      ? Text(
                                          preview,
                                          maxLines: 1,
                                          softWrap: false,
                                          overflow: TextOverflow.clip,
                                          style: previewStyle,
                                        )
                                      : Text.rich(
                                          TextSpan(
                                            style: previewStyle,
                                            children: [
                                              TextSpan(
                                                text: firstName,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  color: ViroColors.gray600,
                                                ),
                                              ),
                                              TextSpan(
                                                text: ' → ',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                  color: arrowColor,
                                                ),
                                              ),
                                              TextSpan(text: preview),
                                            ],
                                          ),
                                          maxLines: 1,
                                          softWrap: false,
                                          overflow: TextOverflow.clip,
                                        ),
                        ),
                      ],
                    ),
                  ),
                  if (hasUnread) ...[
                    const SizedBox(width: ViroSpacing.sm),
                    _UnreadBadge(count: unread),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(
                left: _kDividerIndent,
                right: ViroSpacing.screenHorizontal,
              ),
              child: ColoredBox(
                color: ViroColors.primary100.withValues(alpha: 0.55),
                child: const SizedBox(height: 1, width: double.infinity),
              ),
            ),
          ],
        ),
      ),
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

/// Avatar circulaire : fond teinté marque + initiale couleur club (style portail).
class _ConversationAvatar extends StatelessWidget {
  const _ConversationAvatar({
    required this.initial,
    required this.color,
  });

  final String initial;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final tint = Color.lerp(Colors.white, color, 0.35)!;
    return Container(
      width: _kAvatarSize,
      height: _kAvatarSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tint,
        shape: BoxShape.circle,
      ),
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
