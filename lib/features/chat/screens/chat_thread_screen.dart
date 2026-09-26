import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/chat/chat_thread_open_seed.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_anchored_reactors_popup.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_message_actions.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_app_bar.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_composer.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_dialogs.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_member_maps.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_message_tile.dart';
import 'package:viro_team_v2/features/chat/widgets/create_poll_sheet.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Thread d’une conversation.
class ChatThreadScreen extends ConsumerStatefulWidget {
  const ChatThreadScreen({
    super.key,
    required this.clubId,
    required this.conversationId,
    this.openSeed,
  });

  final String clubId;
  final String conversationId;

  /// Chrome immédiat (titre / couleur) passé depuis l’inbox.
  final ChatThreadOpenSeed? openSeed;

  @override
  ConsumerState<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends ConsumerState<ChatThreadScreen> {
  final _controller = TextEditingController();
  final _composerFocusNode = FocusNode();
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _messagesStackKey = GlobalKey();
  final Map<String, GlobalKey> _messageAnchorKeys = {};

  /// Recherche isolée (pas de setState plein écran à chaque frappe).
  final ValueNotifier<String> _searchQueryNotifier = ValueNotifier('');
  final ValueNotifier<bool> _searchOpenNotifier = ValueNotifier(false);

  /// Proximité du bas + msgs hors viewport (FAB).
  final ValueNotifier<bool> _isNearBottomNotifier = ValueNotifier(true);
  final ValueNotifier<int> _newBelowCountNotifier = ValueNotifier(0);

  bool _sending = false;
  bool _loadingOlder = false;
  bool _hasMoreOlder = true;
  List<ChatMessage> _olderMessages = const [];
  List<ChatMessage> _pendingMessages = const [];
  ChatMessage? _replyTo;

  /// Popup « qui a réagi » ancré au message (null = fermé).
  String? _reactorsMessageId;
  String? _reactorsViewerUid;
  Map<String, String> _reactorsNameByUid = const {};
  Map<String, ClubMember> _reactorsMemberByUid = const {};

  /// Après un envoi : recentrer le fil en bas quand le message arrive.
  bool _scrollToBottomAfterSend = false;

  /// Compteur non-lus figé à l’open (null = pas de séparateur « nouveau »).
  int? _unreadSeparatorCount;

  /// Ancre temporelle figée à l’open (fallback si unreadCount = 0).
  DateTime? _unreadSeparatorAfter;

  /// Liste peinte seulement après le slide (évite jank pendant drill-in).
  ///
  /// GoRouter + [CustomTransitionPage] : `ModalRoute.animation` est déjà
  /// `completed` au 1er build — on s’appuie donc sur [ViroMotion.drillIn].
  bool _routeTransitionSettled = false;

  static const double _kNearBottomThreshold = 100;

  ({String clubId, String conversationId}) get _key => (
        clubId: widget.clubId,
        conversationId: widget.conversationId,
      );

  /// Clé d’ancrage stable pour un message (popup / mesures).
  GlobalKey _anchorKeyFor(String messageId) =>
      _messageAnchorKeys.putIfAbsent(messageId, GlobalKey.new);

  /// Retire les GlobalKey hors de la fenêtre de messages actuelle.
  void _pruneAnchorKeys(Iterable<String> liveIds) {
    final keep = liveIds.toSet();
    _messageAnchorKeys.removeWhere((id, _) => !keep.contains(id));
  }

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onThreadScroll);
    _searchController.addListener(() {
      _searchQueryNotifier.value = _searchController.text.trim();
    });
    final states = ref.read(chatStatesProvider).value ?? const {};
    final stateId = ChatUserState.docId(widget.clubId, widget.conversationId);
    final state = states[stateId];
    final uid = ref.read(authStateProvider).value?.uid;
    final inbox = ref.read(chatInboxProvider).value ?? const [];
    ChatConversation? conv;
    for (final entry in inbox) {
      if (entry.clubId == widget.clubId && entry.id == widget.conversationId) {
        conv = entry;
        break;
      }
    }
    final effective = chatThreadEffectiveUnread(
      conversation: conv,
      state: state,
      viewerUid: uid,
    );
    if (effective > 0) {
      if (state != null && state.unreadCount > 0) {
        _unreadSeparatorCount = state.unreadCount;
      } else if (state?.lastReadAt != null) {
        _unreadSeparatorAfter = state!.lastReadAt;
      } else {
        _unreadSeparatorCount = effective;
      }
    }
    Future<void>.delayed(ViroMotion.drillIn, _revealMessagesAfterTransition);
  }

  /// Affiche la liste + markRead une fois le slide terminé.
  void _revealMessagesAfterTransition() {
    if (!mounted || _routeTransitionSettled) return;
    setState(() => _routeTransitionSettled = true);
    _markRead();
  }

  /// Suit la proximité du bas (FAB) sans setState plein écran.
  void _onThreadScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    final nearBottom = position.pixels <= _kNearBottomThreshold;
    if (nearBottom != _isNearBottomNotifier.value) {
      _isNearBottomNotifier.value = nearBottom;
      if (nearBottom) _newBelowCountNotifier.value = 0;
    }
  }

  /// Ferme le détail des réactions.
  void _dismissReactorsPopup() {
    if (_reactorsMessageId == null) return;
    setState(() {
      _reactorsMessageId = null;
      _reactorsViewerUid = null;
      _reactorsNameByUid = const {};
      _reactorsMemberByUid = const {};
    });
  }

  /// Fusionne historique + live + envois optimistes (live prioritaire).
  List<ChatMessage> _mergedMessages(List<ChatMessage> live) {
    final byId = <String, ChatMessage>{};
    for (final message in _olderMessages) {
      byId[message.id] = message;
    }
    for (final message in live) {
      byId[message.id] = message;
    }
    for (final pending in _pendingMessages) {
      if (!byId.containsKey(pending.id)) {
        byId[pending.id] = pending;
      }
    }
    if (_pendingMessages.isNotEmpty) {
      final liveIds = {for (final m in live) m.id};
      final remaining = _pendingMessages
          .where((p) => !liveIds.contains(p.id))
          .toList(growable: false);
      if (remaining.length != _pendingMessages.length) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          if (_pendingMessages.length != remaining.length) {
            setState(() => _pendingMessages = remaining);
          }
        });
      }
    }
    final merged = byId.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    final ids = merged.map((m) => m.id).toList(growable: false);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _pruneAnchorKeys(ids);
    });
    return merged;
  }

  Future<void> _loadOlderMessages(List<ChatMessage> merged) async {
    if (_loadingOlder || !_hasMoreOlder || merged.isEmpty) return;
    setState(() => _loadingOlder = true);
    final position =
        _scrollController.hasClients ? _scrollController.position : null;
    final extentBefore = position?.maxScrollExtent ?? 0;
    final pixelsBefore = position?.pixels ?? 0;
    try {
      final older = await ref.read(chatServiceProvider).fetchOlderMessages(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            beforeMessageId: merged.first.id,
          );
      if (!mounted) return;
      setState(() {
        if (older.isEmpty) {
          _hasMoreOlder = false;
        } else {
          final existingIds = {
            for (final message in merged) message.id,
          };
          final fresh = older
              .where((message) => !existingIds.contains(message.id))
              .toList();
          _olderMessages = [...fresh, ..._olderMessages];
          if (older.length < 50) _hasMoreOlder = false;
        }
        _loadingOlder = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_scrollController.hasClients) return;
        final after = _scrollController.position;
        final delta = after.maxScrollExtent - extentBefore;
        if (delta > 0) after.jumpTo(pixelsBefore + delta);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingOlder = false);
      ViroSnackBar.show(context, AppCopy.chat.loadOlderFailed);
    }
  }

  void _setReplyTo(ChatMessage message) {
    setState(() => _replyTo = message);
    _composerFocusNode.requestFocus();
  }

  void _clearReply() {
    if (_replyTo == null) return;
    setState(() => _replyTo = null);
  }

  Future<void> _markRead() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    await ref.read(chatServiceProvider).markRead(
          uid: uid,
          clubId: widget.clubId,
          conversationId: widget.conversationId,
        );
  }

  /// Demande un scroll bas après envoi (immédiat + quand le stream pousse).
  void _requestScrollToBottomAfterSend() {
    _scrollToBottomAfterSend = true;
    _isNearBottomNotifier.value = true;
    _newBelowCountNotifier.value = 0;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _animateScrollToBottom();
    });
  }

  /// Anime le fil jusqu’au dernier message (offset 0 en reverse).
  Future<void> _animateScrollToBottom() async {
    if (!mounted || !_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels <= 1) return;
    await _scrollController.animateTo(
      0,
      duration: ViroMotion.modal,
      curve: ViroMotion.enter,
    );
  }

  /// Conversation live, ou fallback inbox pour peindre titre / composer tout de suite.
  ChatConversation? _resolveConversation(ChatConversation? live) {
    if (live != null) return live;
    final inbox = ref.read(chatInboxProvider).value ?? const [];
    for (final entry in inbox) {
      if (entry.clubId == widget.clubId && entry.id == widget.conversationId) {
        return entry;
      }
    }
    return null;
  }

  ({String firstName, String senderRole}) _senderMeta() {
    final user = ref.read(viroUserProvider).value;
    final clubs = ref.read(userClubsProvider).value ?? const [];
    final membership = clubs
        .where((e) => e.club.id == widget.clubId)
        .map((e) => e.membership)
        .firstOrNull;
    final firstName = (user?.firstName.trim().isNotEmpty == true)
        ? user!.firstName.trim()
        : (user?.displayName.trim().split(RegExp(r'\s+')).firstOrNull ?? '');
    return (
      firstName: firstName,
      senderRole: membership?.role ?? 'parent',
    );
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onThreadScroll);
    _controller.dispose();
    _composerFocusNode.dispose();
    _searchController.dispose();
    _scrollController.dispose();
    _searchQueryNotifier.dispose();
    _searchOpenNotifier.dispose();
    _isNearBottomNotifier.dispose();
    _newBelowCountNotifier.dispose();
    super.dispose();
  }

  Future<void> _sendText() async {
    final uid = ref.read(authStateProvider).value?.uid;
    final text = _controller.text.trimRight();
    if (uid == null || text.trim().isEmpty || _sending) return;
    final meta = _senderMeta();
    final reply = _replyTo;
    final clientId = ref.read(chatServiceProvider).allocateMessageId(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
        );
    final optimistic = ChatMessage(
      id: clientId,
      clubId: widget.clubId,
      conversationId: widget.conversationId,
      type: ChatMessageTypes.text,
      text: text,
      senderUid: uid,
      createdAt: DateTime.now(),
      replyToMessageId: reply?.id,
      replyToText: reply == null ? null : chatThreadReplyPreviewText(reply),
      replyToSenderUid: reply?.senderUid,
      localStatus: ChatMessageLocalStatus.sending,
    );
    setState(() {
      _sending = true;
      _pendingMessages = [..._pendingMessages, optimistic];
      _replyTo = null;
    });
    _controller.clear();
    _composerFocusNode.requestFocus();
    _requestScrollToBottomAfterSend();
    try {
      await ref.read(chatServiceProvider).sendTextMessage(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            senderUid: uid,
            text: text,
            senderFirstName: meta.firstName,
            senderRole: meta.senderRole,
            replyToMessageId: reply?.id,
            replyToText:
                reply == null ? null : chatThreadReplyPreviewText(reply),
            replyToSenderUid: reply?.senderUid,
            clientMessageId: clientId,
          );
      await _markRead();
    } catch (_) {
      if (mounted) {
        setState(() {
          _pendingMessages = _pendingMessages
              .map(
                (m) => m.id == clientId
                    ? m.copyWith(localStatus: ChatMessageLocalStatus.failed)
                    : m,
              )
              .toList(growable: false);
        });
        ViroSnackBar.show(context, AppCopy.chat.sendFailed);
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendPhoto({required ImageSource source}) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || _sending) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: source,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (file == null) return;
    final meta = _senderMeta();
    final reply = _replyTo;
    final bytes = Uint8List.fromList(await file.readAsBytes());
    final clientId = ref.read(chatServiceProvider).allocateMessageId(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
        );
    final optimistic = ChatMessage(
      id: clientId,
      clubId: widget.clubId,
      conversationId: widget.conversationId,
      type: ChatMessageTypes.image,
      senderUid: uid,
      createdAt: DateTime.now(),
      replyToMessageId: reply?.id,
      replyToText: reply == null ? null : chatThreadReplyPreviewText(reply),
      replyToSenderUid: reply?.senderUid,
      localStatus: ChatMessageLocalStatus.sending,
      localImageBytes: bytes,
    );
    setState(() {
      _sending = true;
      _pendingMessages = [..._pendingMessages, optimistic];
      _replyTo = null;
    });
    _composerFocusNode.requestFocus();
    _requestScrollToBottomAfterSend();
    try {
      await ref.read(chatServiceProvider).sendImageMessage(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            senderUid: uid,
            bytes: bytes,
            senderFirstName: meta.firstName,
            senderRole: meta.senderRole,
            replyToMessageId: reply?.id,
            replyToText:
                reply == null ? null : chatThreadReplyPreviewText(reply),
            replyToSenderUid: reply?.senderUid,
            clientMessageId: clientId,
          );
      await _markRead();
    } catch (_) {
      if (mounted) {
        setState(() {
          _pendingMessages = _pendingMessages
              .map(
                (m) => m.id == clientId
                    ? m.copyWith(localStatus: ChatMessageLocalStatus.failed)
                    : m,
              )
              .toList(growable: false);
        });
        ViroSnackBar.show(context, AppCopy.chat.photoFailed);
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  /// Relance un message optimiste en échec.
  Future<void> _retryFailedMessage(ChatMessage failed) async {
    if (!failed.isSendFailed || _sending) return;
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    final meta = _senderMeta();
    setState(() {
      _sending = true;
      _pendingMessages = _pendingMessages
          .map(
            (m) => m.id == failed.id
                ? m.copyWith(localStatus: ChatMessageLocalStatus.sending)
                : m,
          )
          .toList(growable: false);
    });
    try {
      if (failed.type == ChatMessageTypes.image) {
        final bytes = failed.localImageBytes;
        if (bytes == null) throw StateError('no local bytes');
        await ref.read(chatServiceProvider).sendImageMessage(
              clubId: widget.clubId,
              conversationId: widget.conversationId,
              senderUid: uid,
              bytes: bytes,
              senderFirstName: meta.firstName,
              senderRole: meta.senderRole,
              replyToMessageId: failed.replyToMessageId,
              replyToText: failed.replyToText,
              replyToSenderUid: failed.replyToSenderUid,
              clientMessageId: failed.id,
            );
      } else {
        await ref.read(chatServiceProvider).sendTextMessage(
              clubId: widget.clubId,
              conversationId: widget.conversationId,
              senderUid: uid,
              text: failed.text ?? '',
              senderFirstName: meta.firstName,
              senderRole: meta.senderRole,
              replyToMessageId: failed.replyToMessageId,
              replyToText: failed.replyToText,
              replyToSenderUid: failed.replyToSenderUid,
              clientMessageId: failed.id,
            );
      }
      await _markRead();
    } catch (_) {
      if (mounted) {
        setState(() {
          _pendingMessages = _pendingMessages
              .map(
                (m) => m.id == failed.id
                    ? m.copyWith(localStatus: ChatMessageLocalStatus.failed)
                    : m,
              )
              .toList(growable: false);
        });
        ViroSnackBar.show(
          context,
          failed.type == ChatMessageTypes.image
              ? AppCopy.chat.photoFailed
              : AppCopy.chat.sendFailed,
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _openPollSheet() async {
    final sent = await showCreatePollSheet(
      context,
      ref: ref,
      clubId: widget.clubId,
      conversationId: widget.conversationId,
    );
    if (sent && mounted) _requestScrollToBottomAfterSend();
  }

  Future<void> _votePoll(ChatMessage message, String optionId) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    try {
      await ref.read(chatServiceProvider).votePollOption(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            messageId: message.id,
            optionId: optionId,
            uid: uid,
          );
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.chat.pollVoteFailed);
      }
    }
  }

  Future<void> _toggleMute(ChatUserState? state) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    final muted = !(state?.muted ?? false);
    await ref.read(chatServiceProvider).setMuted(
          uid: uid,
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          muted: muted,
        );
  }

  Future<void> _toggleFavorite(ChatUserState? state) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    final favorite = !(state?.favorite ?? false);
    await ref.read(chatServiceProvider).setFavorite(
          uid: uid,
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          favorite: favorite,
        );
  }

  Future<void> _rename(ChatConversation conv) async {
    final peerTitles = ref.read(chatDmPeerTitlesProvider);
    final peerName = peerTitles['${conv.clubId}|${conv.id}'];
    final next = await showChatRenameConversationDialog(
      context: context,
      initialTitle: conv.displayTitle(peerDisplayName: peerName),
    );
    if (next == null) return;
    await ref.read(chatServiceProvider).renameConversation(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          titleOverride: next,
        );
  }

  /// Choisit une source puis upload l’avatar du groupe.
  Future<void> _changeGroupAvatar(ChatConversation conv) async {
    if (!conv.canEditGroupAvatar) return;
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: ViroIcon(
                  ViroIcons.camera,
                  color: ViroColors.primary600,
                ),
                title: Text(AppCopy.chat.changeGroupAvatarCamera),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: ViroIcon(
                  ViroIcons.image,
                  color: ViroColors.primary600,
                ),
                title: Text(AppCopy.chat.changeGroupAvatarGallery),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        );
      },
    );
    if (source == null || !mounted) return;

    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: source,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (file == null || !mounted) return;

    try {
      final bytes = await file.readAsBytes();
      final lower = file.path.toLowerCase();
      final contentType = lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
      final avatarUrl =
          await ref.read(conversationAvatarStorageProvider).uploadAvatar(
                clubId: widget.clubId,
                conversationId: widget.conversationId,
                uid: uid,
                bytes: bytes,
                contentType: contentType,
              );
      await ref.read(chatServiceProvider).updateConversationAvatar(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            avatarUrl: avatarUrl,
          );
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.chat.groupAvatarUpdated);
      }
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.chat.groupAvatarUploadFailed);
      }
    }
  }

  Future<void> _deleteMessage(ChatMessage message) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    final ok = await showChatDeleteMessageDialog(context);
    if (!ok) return;
    await ref.read(chatServiceProvider).softDeleteMessage(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          messageId: message.id,
          deletedByUid: uid,
        );
  }

  Future<void> _copyMessage(ChatMessage message) async {
    await copyChatMessageText(
      context: context,
      text: message.text ?? '',
    );
  }

  Future<void> _editMessage(ChatMessage message) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || message.senderUid != uid) return;
    if (message.type != ChatMessageTypes.text) return;
    final next = await showChatEditMessageDialog(
      context: context,
      initialText: message.text ?? '',
    );
    if (next == null) return;
    await ref.read(chatServiceProvider).editTextMessage(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          messageId: message.id,
          text: next,
        );
  }

  Future<void> _react(ChatMessage message, String emoji) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    await ref.read(chatServiceProvider).toggleReaction(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          messageId: message.id,
          emoji: emoji,
          uid: uid,
        );
  }

  void _showMessageActions(ChatMessage message, {required bool mine}) {
    _dismissReactorsPopup();
    final uid = ref.read(authStateProvider).value?.uid;
    showChatMessageActionsSheet(
      context: context,
      message: message,
      mine: mine,
      viewerUid: uid,
      onReply: () => _setReplyTo(message),
      onCopy: () => _copyMessage(message),
      onEdit: () => _editMessage(message),
      onDelete: () => _deleteMessage(message),
      onReact: (emoji) => _react(message, emoji),
      onOpenEmojiPicker: (msg, myEmojis) =>
          _showEmojiPicker(msg, myEmojis: myEmojis),
    );
  }

  /// Grille d’émojis élargie pour réagir au message.
  void _showEmojiPicker(
    ChatMessage message, {
    required Set<String> myEmojis,
  }) {
    showChatEmojiPickerSheet(
      context: context,
      myEmojis: myEmojis,
      onReact: (emoji) => _react(message, emoji),
    );
  }

  /// Affiche qui a réagi, ancré sous/au-dessus du message (suit le scroll).
  void _showReactionReactors({
    required ChatMessage message,
    required String? viewerUid,
    required Map<String, String> nameByUid,
    required Map<String, ClubMember> memberByUid,
  }) {
    final entries = message.reactions.entries
        .where((e) => e.value.isNotEmpty)
        .toList();
    if (entries.isEmpty) return;
    setState(() {
      _reactorsMessageId = message.id;
      _reactorsViewerUid = viewerUid;
      _reactorsNameByUid = Map<String, String>.from(nameByUid);
      _reactorsMemberByUid = Map<String, ClubMember>.from(memberByUid);
    });
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authStateProvider).value?.uid;
    // Tant que le fil est ouvert, chaque arrivée de message remet unread à 0
    // (et rafraîchit lastReadAt pour le trigger push).
    ref.listen(chatMessagesProvider(_key), (previous, next) {
      final messages = next.asData?.value;
      if (messages == null) return;
      final prevMessages = previous?.asData?.value;
      final prevLastId = (prevMessages == null || prevMessages.isEmpty)
          ? null
          : prevMessages.last.id;
      final lastId = messages.isEmpty ? null : messages.last.id;
      if (lastId == null || lastId == prevLastId) return;
      _markRead();
      final nearBottom = _isNearBottomNotifier.value;
      final shouldScroll = _scrollToBottomAfterSend || nearBottom;
      if (!shouldScroll) {
        final last = messages.last;
        if (uid == null || last.senderUid != uid) {
          _newBelowCountNotifier.value = _newBelowCountNotifier.value + 1;
        }
        return;
      }
      _scrollToBottomAfterSend = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _animateScrollToBottom();
      });
    });
    final clubs = ref.watch(userClubsProvider).value ?? const [];
    final membership = clubs
        .where((e) => e.club.id == widget.clubId)
        .map((e) => e.membership)
        .firstOrNull;
    final role = membership?.role;
    final convAsync = ref.watch(chatConversationProvider(_key));
    final messagesAsync = ref.watch(chatMessagesProvider(_key));
    final states = ref.watch(chatStatesProvider).value ?? const {};
    final stateId = ChatUserState.docId(widget.clubId, widget.conversationId);
    final state = states[stateId];
    final conv = _resolveConversation(convAsync.value);
    final members =
        ref.watch(clubMembersProvider(widget.clubId)).value ?? const [];
    final dmPeers = ref.watch(chatDmPeersProvider).value ?? const {};
    final peerFromInbox = dmPeers['${widget.clubId}|${widget.conversationId}'];
    String? peerDisplayName = peerFromInbox?.displayName;
    String? peerAvatarUrl =
        peerFromInbox?.avatarUrl ?? widget.openSeed?.avatarUrl;
    if (peerDisplayName == null && conv != null && uid != null) {
      final peerUid = conv.peerUidFor(uid);
      if (peerUid != null) {
        for (final member in members) {
          if (member.accountUid == peerUid) {
            final name = (member.displayName ?? '').trim();
            if (name.isNotEmpty) {
              peerDisplayName = name;
            }
            final photo = member.avatarUrl?.trim();
            if (peerAvatarUrl == null &&
                photo != null &&
                photo.isNotEmpty) {
              peerAvatarUrl = photo;
            }
            break;
          }
        }
      }
    }
    final title = conv?.displayTitle(peerDisplayName: peerDisplayName) ??
        widget.openSeed?.title ??
        AppCopy.chat.conversationsTitle;
    final avatarColor =
        widget.openSeed?.clubColor ?? ViroColors.primary600;
    final avatarInitial =
        widget.openSeed?.initial ?? avatarInitialFromTitle(title);
    final isGroup = conv?.isGroup ?? widget.openSeed?.isGroup ?? false;
    final isChannel =
        conv?.isReadonlyForMembers ?? widget.openSeed?.isChannel ?? false;
    final groupAvatar = conv?.avatarUrl?.trim();
    final seedAvatar = widget.openSeed?.avatarUrl?.trim();
    final String? headerAvatarUrl;
    if (isGroup) {
      if (groupAvatar != null && groupAvatar.isNotEmpty) {
        headerAvatarUrl = groupAvatar;
      } else if (seedAvatar != null && seedAvatar.isNotEmpty) {
        headerAvatarUrl = seedAvatar;
      } else {
        headerAvatarUrl = null;
      }
    } else {
      headerAvatarUrl = peerAvatarUrl;
    }
    final isAdminOnly = conv?.writePolicy == ChatWritePolicies.adminsOnly;
    final canWrite = chatThreadCanWrite(conv, uid, role);
    final canPoll = canWrite && (conv?.allowsPolls ?? false);

    final liveForBar = messagesAsync.value ?? const <ChatMessage>[];

    return ViroScaffold(
      appBar: ChatThreadAppBar(
        title: title,
        avatarInitial: avatarInitial,
        avatarColor: avatarColor,
        avatarUrl: headerAvatarUrl,
        isGroup: isGroup,
        isChannel: isChannel,
        avatarHeroTag: ChatThreadOpenSeed.avatarHeroTag(
          widget.clubId,
          widget.conversationId,
        ),
        searchOpen: _searchOpenNotifier.value,
        searchController: _searchController,
        isAdminOnly: isAdminOnly,
        clubId: widget.clubId,
        conversation: conv,
        state: state,
        members: members,
        mergedMessages: _routeTransitionSettled
            ? _mergedMessages(liveForBar)
            : const <ChatMessage>[],
        onToggleSearch: () {
          setState(() {
            final next = !_searchOpenNotifier.value;
            _searchOpenNotifier.value = next;
            if (!next) {
              _searchController.clear();
              _searchQueryNotifier.value = '';
            }
          });
        },
        onToggleMute: () => _toggleMute(state),
        onToggleFavorite: () => _toggleFavorite(state),
        onRename: () {
          if (conv != null) _rename(conv);
        },
        onChangeAvatar: conv != null && conv.canEditGroupAvatar
            ? () => _changeGroupAvatar(conv)
            : null,
      ),
      body: Column(
        children: [
          if (isAdminOnly)
            Material(
              color: ViroColors.primary50,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.screenHorizontal,
                  vertical: ViroSpacing.xs,
                ),
                child: Text(
                  AppCopy.chat.readonlyHint,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.primary600,
                      ),
                ),
              ),
            ),
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                const DecoratedBox(
                  decoration: BoxDecoration(
                    color: ViroColors.surface,
                    image: DecorationImage(
                      image: AssetImage('assets/images/chat/thread_bg.png'),
                      repeat: ImageRepeat.repeat,
                      alignment: Alignment.topLeft,
                      scale: 2.5,
                      filterQuality: FilterQuality.medium,
                    ),
                  ),
                ),
                const ColoredBox(color: Color(0x9EFFFFFF)),
                messagesAsync.when(
                  loading: () => const SizedBox.expand(),
                  error: (_, _) =>
                      Center(child: Text(AppCopy.chat.loadError)),
                  data: (liveMessages) {
                    // Pendant le slide : chrome seul (fond + app bar), pas de ListView.
                    if (!_routeTransitionSettled) {
                      return const SizedBox.expand();
                    }
                    final messages = _mergedMessages(liveMessages);
                    if (messages.isEmpty) {
                      return ViroEmptyState(
                        message: AppCopy.chat.emptyThread,
                        icon: ViroIcons.chat,
                      );
                    }
                    final isGroup =
                        conv?.isGroup ?? widget.openSeed?.isGroup ?? false;
                    final reactorsId = _reactorsMessageId;
                    ChatMessage? reactorsMessage;
                    if (reactorsId != null) {
                      for (final m in messages) {
                        if (m.id == reactorsId) {
                          reactorsMessage = m;
                          break;
                        }
                      }
                      final stillHasReactions = reactorsMessage != null &&
                          reactorsMessage.reactions.values
                              .any((uids) => uids.isNotEmpty);
                      if (!stillHasReactions) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) _dismissReactorsPopup();
                        });
                      }
                    }
                    final showLoadMore = _hasMoreOlder && messages.isNotEmpty;
                    final unreadSepCount = _unreadSeparatorCount;
                    final unreadAfter = _unreadSeparatorAfter;
                    int? firstUnreadIndex;
                    if (unreadSepCount != null &&
                        unreadSepCount > 0 &&
                        messages.isNotEmpty) {
                      final byCount = (messages.length - unreadSepCount)
                          .clamp(0, messages.length - 1);
                      for (var i = byCount; i < messages.length; i++) {
                        if (messages[i].senderUid != uid) {
                          firstUnreadIndex = i;
                          break;
                        }
                      }
                    } else if (unreadAfter != null && messages.isNotEmpty) {
                      for (var i = 0; i < messages.length; i++) {
                        final message = messages[i];
                        if (message.createdAt.isAfter(unreadAfter) &&
                            message.senderUid != uid) {
                          firstUnreadIndex = i;
                          break;
                        }
                      }
                    }
                    final lookup = chatThreadMemberLookupMaps(
                      members: members,
                      viewerUid: uid,
                    );
                    return Stack(
                      key: _messagesStackKey,
                      fit: StackFit.expand,
                      children: [
                        ValueListenableBuilder<bool>(
                          valueListenable: _searchOpenNotifier,
                          builder: (context, searchOpen, _) {
                            return ValueListenableBuilder<String>(
                              valueListenable: _searchQueryNotifier,
                              builder: (context, searchQuery, _) {
                                return GestureDetector(
                                  behavior: HitTestBehavior.deferToChild,
                                  onTap: _dismissReactorsPopup,
                                  child: ListView.builder(
                                    controller: _scrollController,
                                    keyboardDismissBehavior:
                                        ScrollViewKeyboardDismissBehavior
                                            .onDrag,
                                    reverse: true,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: ViroSpacing.screenHorizontal,
                                      vertical: ViroSpacing.sm,
                                    ),
                                    itemCount: messages.length +
                                        (showLoadMore ? 1 : 0),
                                    itemBuilder: (context, index) {
                                      if (showLoadMore &&
                                          index == messages.length) {
                                        return Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: ViroSpacing.sm,
                                          ),
                                          child: Center(
                                            child: _loadingOlder
                                                ? const SizedBox(
                                                    width: 24,
                                                    height: 24,
                                                    child:
                                                        CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                    ),
                                                  )
                                                : TextButton(
                                                    onPressed: () =>
                                                        _loadOlderMessages(
                                                      messages,
                                                    ),
                                                    child: Text(
                                                      AppCopy
                                                          .chat.loadOlderMessages,
                                                    ),
                                                  ),
                                          ),
                                        );
                                      }
                                      final messageIndex =
                                          messages.length - 1 - index;
                                      final message = messages[messageIndex];
                                      return ChatThreadMessageTile(
                                        message: message,
                                        previousCreatedAt: messageIndex == 0
                                            ? null
                                            : messages[messageIndex - 1]
                                                .createdAt,
                                        mine: message.senderUid == uid,
                                        viewerUid: uid,
                                        isGroup: isGroup,
                                        members: members,
                                        nameByUid: lookup.nameByUid,
                                        memberByUid: lookup.memberByUid,
                                        anchorKey: _anchorKeyFor(message.id),
                                        messageAnchorKeys: _messageAnchorKeys,
                                        showUnreadSeparator:
                                            firstUnreadIndex != null &&
                                                messageIndex ==
                                                    firstUnreadIndex,
                                        searchOpen: searchOpen,
                                        searchQuery: searchQuery,
                                        clubId: widget.clubId,
                                        conversationId: widget.conversationId,
                                        participantCount:
                                            conv?.participantUids.length ?? 0,
                                        reactorsMessageId: _reactorsMessageId,
                                        onShowActions: _showMessageActions,
                                        onReact: _react,
                                        onOpenReactors: _showReactionReactors,
                                        onDismissReactors:
                                            _dismissReactorsPopup,
                                        onVotePoll: _votePoll,
                                        onRetrySend: message.isSendFailed
                                            ? () =>
                                                _retryFailedMessage(message)
                                            : null,
                                      );
                                    },
                                  ),
                                );
                              },
                            );
                          },
                        ),
                        if (reactorsMessage != null &&
                            reactorsMessage.reactions.values
                                .any((uids) => uids.isNotEmpty))
                          ChatAnchoredReactorsPopup(
                            stackKey: _messagesStackKey,
                            anchorKey: _anchorKeyFor(reactorsMessage.id),
                            message: reactorsMessage,
                            mine: reactorsMessage.senderUid == uid,
                            viewerUid: _reactorsViewerUid,
                            nameByUid: _reactorsNameByUid,
                            memberByUid: _reactorsMemberByUid,
                            scrollController: _scrollController,
                            onDismiss: _dismissReactorsPopup,
                            onAddReaction: () {
                              final message = reactorsMessage!;
                              final viewerUid = _reactorsViewerUid;
                              final myEmojis = <String>{
                                for (final e in message.reactions.entries)
                                  if (viewerUid != null &&
                                      e.value.contains(viewerUid))
                                    e.key,
                              };
                              _dismissReactorsPopup();
                              _showEmojiPicker(message, myEmojis: myEmojis);
                            },
                            onToggleReaction: (emoji) {
                              final message = reactorsMessage!;
                              _dismissReactorsPopup();
                              _react(message, emoji);
                            },
                          ),
                        Positioned(
                          right: ViroSpacing.screenHorizontal,
                          bottom: ViroSpacing.md,
                          child: ValueListenableBuilder<bool>(
                            valueListenable: _isNearBottomNotifier,
                            builder: (context, nearBottom, _) {
                              if (nearBottom) {
                                return const SizedBox.shrink();
                              }
                              return ValueListenableBuilder<int>(
                                valueListenable: _newBelowCountNotifier,
                                builder: (context, newCount, _) {
                                  final label = newCount > 0
                                      ? AppCopy.chat
                                          .newMessagesBelow(newCount)
                                      : AppCopy.chat.jumpToLatest;
                                  return Material(
                                    color: Colors.transparent,
                                    child: Tooltip(
                                      message: label,
                                      child: Badge(
                                        isLabelVisible: newCount > 0,
                                        label: Text('$newCount'),
                                        child: ViroFloatingIconButton(
                                          icon: ViroIcons.arrowDown,
                                          tooltip: label,
                                          circular: true,
                                          onPressed: () {
                                            _newBelowCountNotifier.value = 0;
                                            _isNearBottomNotifier.value = true;
                                            _animateScrollToBottom();
                                          },
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              );
                            },
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
          if (canWrite)
            ChatThreadComposer(
              controller: _controller,
              focusNode: _composerFocusNode,
              sending: _sending,
              canPoll: canPoll,
              showReplyBar: _replyTo != null,
              replyToSenderName: _replyTo == null
                  ? ''
                  : chatThreadSenderFirstName(_replyTo!.senderUid, members),
              replyPreview: _replyTo == null
                  ? ''
                  : chatThreadReplyPreviewText(_replyTo!),
              onClearReply: _clearReply,
              onSend: _sendText,
              onCamera: () => _sendPhoto(source: ImageSource.camera),
              onGallery: () => _sendPhoto(source: ImageSource.gallery),
              onPoll: canPoll ? _openPollSheet : null,
            ),
        ],
      ),
    );
  }
}
