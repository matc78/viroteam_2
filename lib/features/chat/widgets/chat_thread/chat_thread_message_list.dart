import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/providers/chat_thread_controller.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_message_tile.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Liste inversée des messages d’un fil (+ « Charger plus » en haut).
///
/// Écoute seule la recherche ([searchOpen] / [searchQuery]) pour ne pas
/// reconstruire l’écran à chaque frappe.
class ChatThreadMessageList extends StatelessWidget {
  const ChatThreadMessageList({
    super.key,
    required this.view,
    required this.chrome,
    required this.clubId,
    required this.conversationId,
    required this.viewerUid,
    required this.scrollController,
    required this.searchOpen,
    required this.searchQuery,
    required this.currentSearchMatchId,
    required this.anchorKeyFor,
    required this.messageAnchorKeys,
    required this.reactorsMessageId,
    required this.onLoadOlder,
    required this.onDismissReactors,
    required this.onShowActions,
    required this.onReact,
    required this.onOpenReactors,
    required this.onVotePoll,
    required this.onRetrySend,
    this.onReply,
  });

  final ChatThreadMessagesView view;
  final ChatThreadChrome chrome;
  final String clubId;
  final String conversationId;
  final String? viewerUid;
  final ScrollController scrollController;
  final ValueListenable<bool> searchOpen;
  final ValueListenable<String> searchQuery;

  /// Id du résultat de recherche sélectionné (`null` = aucun).
  final ValueListenable<String?> currentSearchMatchId;
  final GlobalKey Function(String messageId) anchorKeyFor;
  final Map<String, GlobalKey> messageAnchorKeys;
  final String? reactorsMessageId;
  final VoidCallback onLoadOlder;
  final VoidCallback onDismissReactors;
  final void Function(ChatMessage message, {required bool mine}) onShowActions;
  final void Function(ChatMessage message, String emoji) onReact;
  final void Function({
    required ChatMessage message,
    required String? viewerUid,
    required Map<String, String> nameByUid,
    required Map<String, ClubMember> memberByUid,
  })
  onOpenReactors;
  final void Function(ChatMessage message, String optionId) onVotePoll;
  final void Function(ChatMessage message) onRetrySend;

  /// Répondre (action des lecteurs d’écran) ; `null` en lecture seule.
  final void Function(ChatMessage message)? onReply;

  @override
  Widget build(BuildContext context) {
    final messages = view.messages;
    final palette = context.viroPalette;
    return ValueListenableBuilder<bool>(
      valueListenable: searchOpen,
      builder: (context, isSearchOpen, _) {
        return ListenableBuilder(
          listenable: Listenable.merge([searchQuery, currentSearchMatchId]),
          builder: (context, _) {
            final query = searchQuery.value;
            final currentMatchId = currentSearchMatchId.value;
            return GestureDetector(
              behavior: HitTestBehavior.deferToChild,
              onTap: () {
                FocusManager.instance.primaryFocus?.unfocus();
                onDismissReactors();
              },
              child: ListView.builder(
                controller: scrollController,
                // Toujours scrollable : glisser vers le bas ferme le clavier
                // même quand le fil tient sur un écran.
                physics: const AlwaysScrollableScrollPhysics(),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                reverse: true,
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.screenHorizontal,
                  vertical: ViroSpacing.sm,
                ),
                itemCount: messages.length + (view.showLoadMore ? 1 : 0),
                itemBuilder: (context, index) {
                  if (view.showLoadMore && index == messages.length) {
                    return _LoadOlderTile(
                      loading: view.loadingOlder,
                      onLoad: onLoadOlder,
                    );
                  }
                  final messageIndex = messages.length - 1 - index;
                  final message = messages[messageIndex];
                  return ChatThreadMessageTile(
                    message: message,
                    previousCreatedAt: messageIndex == 0
                        ? null
                        : messages[messageIndex - 1].createdAt,
                    mine: message.senderUid == viewerUid,
                    viewerUid: viewerUid,
                    isGroup: chrome.isGroup,
                    members: chrome.members,
                    nameByUid: chrome.nameByUid,
                    memberByUid: chrome.memberByUid,
                    anchorKey: anchorKeyFor(message.id),
                    messageAnchorKeys: messageAnchorKeys,
                    showUnreadSeparator: messageIndex == view.firstUnreadIndex,
                    groupPosition: view.groupPositions[messageIndex],
                    uploadProgress: view.uploadProgress[message.id],
                    isCurrentSearchMatch:
                        isSearchOpen && message.id == currentMatchId,
                    searchOpen: isSearchOpen,
                    searchQuery: query,
                    clubId: clubId,
                    conversationId: conversationId,
                    participantCount:
                        chrome.conversation?.participantUids.length ?? 0,
                    clubColor: chrome.clubColor ?? palette.accent,
                    reactorsMessageId: reactorsMessageId,
                    onShowActions: onShowActions,
                    onReact: onReact,
                    onOpenReactors: onOpenReactors,
                    onDismissReactors: onDismissReactors,
                    onVotePoll: onVotePoll,
                    onRetrySend: message.isSendFailed
                        ? () => onRetrySend(message)
                        : null,
                    onReply: onReply,
                  );
                },
              ),
            );
          },
        );
      },
    );
  }
}

/// « Charger plus » en haut du fil (spinner pendant le chargement).
class _LoadOlderTile extends StatelessWidget {
  const _LoadOlderTile({required this.loading, required this.onLoad});

  final bool loading;
  final VoidCallback onLoad;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: Center(
        child: loading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : TextButton(
                onPressed: onLoad,
                child: Text(AppCopy.chat.loadOlderMessages),
              ),
      ),
    );
  }
}
