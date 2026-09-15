import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Tuile inbox : titre, preview, nom club gris, accent couleur club.
class ConversationListTile extends StatelessWidget {
  const ConversationListTile({
    super.key,
    required this.conversation,
    required this.clubName,
    required this.clubColor,
    required this.onTap,
    this.state,
  });

  final ChatConversation conversation;
  final String clubName;
  final Color clubColor;
  final VoidCallback onTap;
  final ChatUserState? state;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final unread = state?.unreadCount ?? 0;
    final muted = state?.muted ?? false;

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
                      if (muted)
                        ViroIcon(
                          ViroIcons.bell,
                          size: 16,
                          color: ViroColors.gray400,
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
                  Text(
                    conversation.lastMessagePreview.isEmpty
                        ? '—'
                        : conversation.lastMessagePreview,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.bodySmall?.copyWith(
                      color: ViroColors.gray600,
                      fontWeight:
                          unread > 0 ? FontWeight.w600 : FontWeight.w400,
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
