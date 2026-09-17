import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Tuile inbox : titre, preview « prénom → message », accent couleur club.
class ConversationListTile extends StatelessWidget {
  const ConversationListTile({
    super.key,
    required this.conversation,
    required this.clubName,
    required this.clubColor,
    required this.onTap,
    this.state,
    this.previewFirstName,
    this.previewSenderRole,
  });

  final ChatConversation conversation;
  final String clubName;
  final Color clubColor;
  final VoidCallback onTap;
  final ChatUserState? state;

  /// Prénom de l’auteur du dernier message (persisté ou résolu).
  final String? previewFirstName;

  /// Rôle de l’auteur (`player` | `coach` | `admin` | `parent`).
  final String? previewSenderRole;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final unread = state?.unreadCount ?? 0;
    final muted = state?.muted ?? false;
    final favorite = state?.favorite ?? false;
    final preview = conversation.lastMessagePreview.trim();
    final firstName = (previewFirstName ??
            conversation.lastSenderFirstName ??
            '')
        .trim();
    final role = (previewSenderRole ?? conversation.lastSenderRole ?? '')
        .trim();
    final arrowColor = chatBubbleBorderForRole(role.isEmpty ? 'player' : role);
    final previewStyle = theme.bodySmall?.copyWith(
      color: ViroColors.gray600,
      fontWeight: unread > 0 ? FontWeight.w600 : FontWeight.w400,
    );

    return ViroPressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.screenHorizontal,
          vertical: ViroSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 4,
              height: 48,
              decoration: BoxDecoration(
                color: clubColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conversation.displayTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.titleSmall?.copyWith(
                            fontWeight:
                                unread > 0 ? FontWeight.w700 : FontWeight.w600,
                            color: ViroColors.primary800,
                          ),
                        ),
                      ),
                      if (favorite) ...[
                        ViroIcon(
                          ViroIcons.favoriteFill,
                          size: 16,
                          color: ViroColors.error,
                        ),
                        const SizedBox(width: 4),
                      ],
                      if (muted)
                        ViroIcon(
                          ViroIcons.mute,
                          size: 16,
                          color: ViroColors.primary600,
                        ),
                      if (unread > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: const BoxDecoration(
                            color: ViroColors.error,
                            borderRadius: BorderRadius.all(Radius.circular(10)),
                          ),
                          child: Text(
                            unread > 99 ? '99+' : '$unread',
                            style: theme.labelSmall?.copyWith(
                              color: ViroColors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    clubName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.labelSmall?.copyWith(
                      color: ViroColors.gray400,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (preview.isEmpty)
                    Text('—', maxLines: 1, style: previewStyle)
                  else
                    _FadingPreviewLine(
                      child: firstName.isEmpty
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
          ],
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
            final fadeStart =
                ((maxWidth - 36) / maxWidth).clamp(0.0, 1.0);
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
