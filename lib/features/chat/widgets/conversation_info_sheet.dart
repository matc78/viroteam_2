import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/linkify_message_text.dart';
import 'package:viro_team_v2/widgets/lists/poll_voter_list_tile.dart';

/// Médias extraits d’un thread (photos + liens).
class ConversationMediaBundle {
  const ConversationMediaBundle({
    required this.imageUrls,
    required this.linkUrls,
  });

  final List<String> imageUrls;
  final List<String> linkUrls;
}

/// Extrait photos et URLs des messages chargés.
ConversationMediaBundle extractConversationMedia(List<ChatMessage> messages) {
  final images = <String>[];
  final links = <String>[];
  final seenLinks = <String>{};
  for (final message in messages) {
    if (message.isDeleted) continue;
    if (message.type == ChatMessageTypes.image) {
      final url = (message.thumbUrl ?? message.downloadUrl ?? '').trim();
      if (url.isNotEmpty) images.add(url);
    }
    final text = message.text ?? '';
    for (final href in extractUrlsFromText(text)) {
      if (seenLinks.add(href)) links.add(href);
    }
  }
  return ConversationMediaBundle(imageUrls: images, linkUrls: links);
}

/// Bottom sheet infos conversation : actions + participants (+ médias optionnels).
Future<void> showConversationInfoSheet({
  required BuildContext context,
  required ChatConversation conversation,
  required ChatUserState? state,
  required List<ClubMember> members,
  required List<ChatMessage> messages,
  required VoidCallback onToggleMute,
  required VoidCallback onToggleFavorite,
  required VoidCallback onRename,
  void Function(String imageUrl)? onOpenImage,
}) {
  final participantMembers = <ClubMember>[];
  final seen = <String>{};
  for (final uid in conversation.participantUids) {
    for (final member in members) {
      if (member.accountUid == uid && seen.add(uid)) {
        participantMembers.add(member);
        break;
      }
    }
  }
  final media = extractConversationMedia(messages);
  final muted = state?.muted ?? false;
  final favorite = state?.favorite ?? false;

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      return DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.65,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        builder: (context, scrollController) {
          return SafeArea(
            child: ListView(
              controller: scrollController,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.md,
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.sm,
                  ),
                  child: Text(
                    AppCopy.chat.conversationInfo,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: ViroColors.primary800,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                ListTile(
                  leading: ViroIcon(
                    favorite ? ViroIcons.favoriteFill : ViroIcons.favorite,
                    color: ViroColors.primary600,
                  ),
                  title: Text(
                    favorite
                        ? AppCopy.chat.removeFavorite
                        : AppCopy.chat.addFavorite,
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    onToggleFavorite();
                  },
                ),
                ListTile(
                  leading: ViroIcon(
                    muted ? ViroIcons.bell : ViroIcons.mute,
                    color: ViroColors.primary600,
                  ),
                  title: Text(
                    muted ? AppCopy.chat.unmute : AppCopy.chat.mute,
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    onToggleMute();
                  },
                ),
                ListTile(
                  leading: ViroIcon(
                    ViroIcons.edit,
                    color: ViroColors.primary600,
                  ),
                  title: Text(AppCopy.chat.renameConversation),
                  onTap: () {
                    Navigator.pop(ctx);
                    onRename();
                  },
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.md,
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.sm,
                  ),
                  child: Text(
                    '${AppCopy.chat.conversationMembers} (${conversation.participantUids.length})',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: ViroColors.primary800,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                for (final member in participantMembers)
                  PollVoterListTile(
                    displayName: _memberDisplayName(member),
                    member: member,
                  ),
                if (participantMembers.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ViroSpacing.screenHorizontal,
                      vertical: ViroSpacing.sm,
                    ),
                    child: Text(
                      AppCopy.chat.pollUnknownVoter,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: ViroColors.gray600,
                          ),
                    ),
                  ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.md,
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.sm,
                  ),
                  child: Text(
                    AppCopy.chat.conversationMedia,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: ViroColors.primary800,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                if (media.imageUrls.isEmpty && media.linkUrls.isEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      ViroSpacing.screenHorizontal,
                      0,
                      ViroSpacing.screenHorizontal,
                      ViroSpacing.md,
                    ),
                    child: Text(
                      AppCopy.chat.noConversationMedia,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: ViroColors.gray600,
                          ),
                    ),
                  )
                else ...[
                  if (media.imageUrls.isNotEmpty)
                    SizedBox(
                      height: 88,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                          horizontal: ViroSpacing.screenHorizontal,
                        ),
                        itemCount: media.imageUrls.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(width: ViroSpacing.sm),
                        itemBuilder: (context, index) {
                          final url = media.imageUrls[index];
                          return GestureDetector(
                            onTap: onOpenImage == null
                                ? null
                                : () {
                                    Navigator.pop(ctx);
                                    onOpenImage(url);
                                  },
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                url,
                                width: 88,
                                height: 88,
                                fit: BoxFit.cover,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  for (final link in media.linkUrls)
                    ListTile(
                      leading: ViroIcon(
                        ViroIcons.attachment,
                        color: ViroColors.primary600,
                      ),
                      title: Text(
                        link,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: ViroColors.primary600),
                      ),
                    ),
                  const SizedBox(height: ViroSpacing.md),
                ],
              ],
            ),
          );
        },
      );
    },
  );
}

String _memberDisplayName(ClubMember member) {
  final first = member.firstName?.trim() ?? '';
  if (first.isNotEmpty) return first;
  final display = member.displayName?.trim() ?? '';
  if (display.isNotEmpty) return display;
  return AppCopy.chat.pollUnknownVoter;
}
