import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_bubble_timestamp.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_reaction_chip.dart';
import 'package:viro_team_v2/models/chat_message.dart';

/// Bulle texte / image d’un message du fil (hors sondage).
class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.anchorKey,
    required this.message,
    required this.mine,
    required this.viewerUid,
    required this.borderColor,
    required this.onLongPress,
    required this.onDoubleTap,
    required this.onOpenReactors,
    this.senderLabel = '',
    this.replySenderLabel = '',
    this.highlightQuery,
    this.isSearchMatch = false,
    this.onImageTap,
    this.onReplyTap,
  });

  /// Ancre visuelle de la bulle (pas le Align pleine largeur).
  final GlobalKey anchorKey;
  final ChatMessage message;
  final bool mine;
  final String? viewerUid;
  final Color borderColor;
  final VoidCallback onLongPress;
  final VoidCallback onDoubleTap;
  final VoidCallback onOpenReactors;

  /// Prénom + nom en haut de bulle (groupes, messages des autres).
  final String senderLabel;
  final String replySenderLabel;
  final String? highlightQuery;
  final bool isSearchMatch;
  final VoidCallback? onImageTap;
  final VoidCallback? onReplyTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final align = mine ? Alignment.centerRight : Alignment.centerLeft;

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

    final reactionEntries = message.reactions.entries
        .where((e) => e.value.isNotEmpty)
        .toList();
    final hasReactions = reactionEntries.isNotEmpty;
    final imageUrl = (message.thumbUrl ?? message.downloadUrl ?? '').trim();

    return Align(
      alignment: align,
      child: Padding(
        // Espace bas pour les chips qui débordent sur la bordure.
        padding: EdgeInsets.only(
          top: 4,
          bottom: hasReactions ? 20 : 4,
        ),
        child: Stack(
          key: anchorKey,
          clipBehavior: Clip.none,
          children: [
            GestureDetector(
              onLongPress: onLongPress,
              onDoubleTap: onDoubleTap,
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                ),
                decoration: BoxDecoration(
                  color: isSearchMatch
                      ? ViroColors.warning.withValues(alpha: 0.12)
                      : ViroColors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: borderColor, width: 1.5),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (senderLabel.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text(
                          senderLabel,
                          style: theme.labelSmall?.copyWith(
                            color: borderColor,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    if (message.hasReply)
                      GestureDetector(
                        onTap: onReplyTap,
                        child: Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: ViroColors.primary50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border(
                              left: BorderSide(
                                color: borderColor,
                                width: 3,
                              ),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (replySenderLabel.isNotEmpty)
                                Text(
                                  replySenderLabel,
                                  style: theme.labelSmall?.copyWith(
                                    color: borderColor,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              Text(
                                message.replyToText ?? '',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.bodySmall?.copyWith(
                                  color: ViroColors.gray600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (message.type == ChatMessageTypes.image &&
                        imageUrl.isNotEmpty)
                      GestureDetector(
                        onTap: onImageTap,
                        child: Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                imageUrl,
                                fit: BoxFit.cover,
                                width: 220,
                              ),
                            ),
                            Positioned(
                              right: 6,
                              bottom: 6,
                              child: ChatBubbleTimestamp(
                                sentAt: message.createdAt,
                                edited: message.editedAt != null,
                                onImage: true,
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      ChatBubbleTextWithTime(
                        text: message.text ?? '',
                        sentAt: message.createdAt,
                        edited: message.editedAt != null,
                        highlightQuery: highlightQuery,
                        style: theme.bodyMedium?.copyWith(
                          color: ViroColors.primary800,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (hasReactions)
              Positioned(
                // Messages à gauche → chips à droite ; messages à toi → à gauche.
                left: mine ? 8 : null,
                right: mine ? null : 8,
                bottom: -16,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(999),
                    onTap: onOpenReactors,
                    child: Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        for (final entry in reactionEntries)
                          ChatReactionChip(
                            emoji: entry.key,
                            count: entry.value.length,
                            mine: viewerUid != null &&
                                entry.value.contains(viewerUid),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
