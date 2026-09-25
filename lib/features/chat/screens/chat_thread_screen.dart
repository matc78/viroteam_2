import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
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
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Thread d’une conversation.
class ChatThreadScreen extends ConsumerStatefulWidget {
  const ChatThreadScreen({
    super.key,
    required this.clubId,
    required this.conversationId,
  });

  final String clubId;
  final String conversationId;

  @override
  ConsumerState<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends ConsumerState<ChatThreadScreen> {
  final _controller = TextEditingController();
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _messagesStackKey = GlobalKey();
  final Map<String, GlobalKey> _messageAnchorKeys = {};
  bool _sending = false;
  bool _searchOpen = false;
  String _searchQuery = '';
  bool _loadingOlder = false;
  bool _hasMoreOlder = true;
  List<ChatMessage> _olderMessages = const [];
  ChatMessage? _replyTo;

  /// Popup « qui a réagi » ancré au message (null = fermé).
  String? _reactorsMessageId;
  String? _reactorsViewerUid;
  Map<String, String> _reactorsNameByUid = const {};
  Map<String, ClubMember> _reactorsMemberByUid = const {};

  /// Après un envoi : recentrer le fil en bas quand le message arrive.
  bool _scrollToBottomAfterSend = false;

  /// À l’ouverture du fil : placer la vue sur les derniers messages.
  bool _needsInitialScrollToBottom = true;

  /// True si le bas du fil est visible (seuil [_kNearBottomThreshold]).
  bool _isNearBottom = true;

  /// Compteur non-lus figé à l’open (null = pas de séparateur « nouveau »).
  int? _unreadSeparatorCount;

  /// Ancre temporelle figée à l’open (fallback si unreadCount = 0).
  DateTime? _unreadSeparatorAfter;

  static const double _kNearBottomThreshold = 100;

  ({String clubId, String conversationId}) get _key => (
        clubId: widget.clubId,
        conversationId: widget.conversationId,
      );

  /// Clé d’ancrage stable pour un message (popup / mesures).
  GlobalKey _anchorKeyFor(String messageId) =>
      _messageAnchorKeys.putIfAbsent(messageId, GlobalKey.new);

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onThreadScroll);
    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text.trim());
    });
    final states = ref.read(chatStatesProvider).value ?? const {};
    final stateId = ChatUserState.docId(widget.clubId, widget.conversationId);
    final state = states[stateId];
    final uid = ref.read(authStateProvider).value?.uid;
    // Conversation inbox pour le fallback lastReadAt (peut être absente).
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
  }

  /// Repositionne le popup de réactions et suit la proximité du bas.
  void _onThreadScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    final distance = position.maxScrollExtent - position.pixels;
    final nearBottom = distance <= _kNearBottomThreshold;
    if (nearBottom != _isNearBottom) {
      _isNearBottom = nearBottom;
    }
    if (_reactorsMessageId != null && mounted) setState(() {});
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

  /// Fusionne l’historique chargé + la fenêtre live (live prioritaire).
  List<ChatMessage> _mergedMessages(List<ChatMessage> live) {
    final byId = <String, ChatMessage>{};
    for (final message in _olderMessages) {
      byId[message.id] = message;
    }
    for (final message in live) {
      byId[message.id] = message;
    }
    final merged = byId.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return merged;
  }

  Future<void> _loadOlderMessages(List<ChatMessage> merged) async {
    if (_loadingOlder || !_hasMoreOlder || merged.isEmpty) return;
    setState(() => _loadingOlder = true);
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
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingOlder = false);
      ViroSnackBar.show(context, AppCopy.chat.loadOlderFailed);
    }
  }

  void _setReplyTo(ChatMessage message) {
    setState(() => _replyTo = message);
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _animateScrollToBottom();
    });
  }

  /// Place le fil en bas sans animation (ouverture du thread).
  void _jumpScrollToBottom() {
    if (!mounted || !_scrollController.hasClients) return;
    final target = _scrollController.position.maxScrollExtent;
    _scrollController.jumpTo(target);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      final maxAfter = _scrollController.position.maxScrollExtent;
      if ((_scrollController.offset - maxAfter).abs() > 1) {
        _scrollController.jumpTo(maxAfter);
      }
    });
  }

  /// Au premier chargement du fil, saute vers les derniers messages.
  void _scheduleInitialScrollToBottomIfNeeded(List<ChatMessage> messages) {
    if (!_needsInitialScrollToBottom || messages.isEmpty) return;
    _needsInitialScrollToBottom = false;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _jumpScrollToBottom();
    });
  }

  /// Anime le fil jusqu’au dernier message.
  Future<void> _animateScrollToBottom() async {
    if (!mounted || !_scrollController.hasClients) return;
    final position = _scrollController.position;
    final target = position.maxScrollExtent;
    if ((position.pixels - target).abs() < 1) return;
    await _scrollController.animateTo(
      target,
      duration: ViroMotion.modal,
      curve: ViroMotion.enter,
    );
    if (!mounted || !_scrollController.hasClients) return;
    final maxAfter = _scrollController.position.maxScrollExtent;
    if ((_scrollController.offset - maxAfter).abs() > 4) {
      await _scrollController.animateTo(
        maxAfter,
        duration: ViroMotion.fast,
        curve: ViroMotion.enter,
      );
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onThreadScroll);
    _controller.dispose();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendText() async {
    final uid = ref.read(authStateProvider).value?.uid;
    final text = _controller.text.trimRight();
    if (uid == null || text.trim().isEmpty || _sending) return;
    final user = ref.read(viroUserProvider).value;
    final clubs = ref.read(userClubsProvider).value ?? const [];
    final membership = clubs
        .where((e) => e.club.id == widget.clubId)
        .map((e) => e.membership)
        .firstOrNull;
    final firstName = (user?.firstName.trim().isNotEmpty == true)
        ? user!.firstName.trim()
        : (user?.displayName.trim().split(RegExp(r'\s+')).firstOrNull ?? '');
    final senderRole = membership?.role ?? 'parent';
    setState(() => _sending = true);
    _controller.clear();
    final reply = _replyTo;
    _clearReply();
    try {
      await ref.read(chatServiceProvider).sendTextMessage(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            senderUid: uid,
            text: text,
            senderFirstName: firstName,
            senderRole: senderRole,
            replyToMessageId: reply?.id,
            replyToText:
                reply == null ? null : chatThreadReplyPreviewText(reply),
            replyToSenderUid: reply?.senderUid,
          );
      await _markRead();
      if (mounted) _requestScrollToBottomAfterSend();
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.chat.sendFailed);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendPhoto({required ImageSource source}) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || _sending) return;
    final user = ref.read(viroUserProvider).value;
    final clubs = ref.read(userClubsProvider).value ?? const [];
    final membership = clubs
        .where((e) => e.club.id == widget.clubId)
        .map((e) => e.membership)
        .firstOrNull;
    final firstName = (user?.firstName.trim().isNotEmpty == true)
        ? user!.firstName.trim()
        : (user?.displayName.trim().split(RegExp(r'\s+')).firstOrNull ?? '');
    final senderRole = membership?.role ?? 'parent';
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: source,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (file == null) return;
    setState(() => _sending = true);
    final reply = _replyTo;
    _clearReply();
    try {
      final bytes = await file.readAsBytes();
      await ref.read(chatServiceProvider).sendImageMessage(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            senderUid: uid,
            bytes: Uint8List.fromList(bytes),
            senderFirstName: firstName,
            senderRole: senderRole,
            replyToMessageId: reply?.id,
            replyToText:
                reply == null ? null : chatThreadReplyPreviewText(reply),
            replyToSenderUid: reply?.senderUid,
          );
      await _markRead();
      if (mounted) _requestScrollToBottomAfterSend();
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.chat.photoFailed);
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
    final peerTitles =
        ref.read(chatDmPeerTitlesProvider).value ?? const <String, String>{};
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
      _scheduleInitialScrollToBottomIfNeeded(messages);
      final prevMessages = previous?.asData?.value;
      final prevLastId = (prevMessages == null || prevMessages.isEmpty)
          ? null
          : prevMessages.last.id;
      final lastId = messages.isEmpty ? null : messages.last.id;
      if (lastId == null || lastId == prevLastId) return;
      _markRead();
      final shouldScroll = _scrollToBottomAfterSend || _isNearBottom;
      if (!shouldScroll) return;
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
    // Cache déjà dispo à l’open : ref.listen ne rejoue pas la valeur courante.
    final cachedLive = messagesAsync.asData?.value;
    if (cachedLive != null) {
      _scheduleInitialScrollToBottomIfNeeded(cachedLive);
    }
    final states = ref.watch(chatStatesProvider).value ?? const {};
    final stateId = ChatUserState.docId(widget.clubId, widget.conversationId);
    final state = states[stateId];
    final conv = convAsync.value;
    final members =
        ref.watch(clubMembersProvider(widget.clubId)).value ?? const [];
    final dmPeerTitles =
        ref.watch(chatDmPeerTitlesProvider).value ?? const {};
    final peerFromInbox =
        dmPeerTitles['${widget.clubId}|${widget.conversationId}'];
    String? peerDisplayName = peerFromInbox;
    if (peerDisplayName == null && conv != null && uid != null) {
      final peerUid = conv.peerUidFor(uid);
      if (peerUid != null) {
        for (final member in members) {
          if (member.accountUid == peerUid) {
            final name = (member.displayName ?? '').trim();
            if (name.isNotEmpty) {
              peerDisplayName = name;
              break;
            }
          }
        }
      }
    }
    final title = conv?.displayTitle(peerDisplayName: peerDisplayName) ??
        AppCopy.chat.conversationsTitle;
    final isAdminOnly = conv?.writePolicy == ChatWritePolicies.adminsOnly;
    final canWrite = chatThreadCanWrite(conv, uid, role);
    final canPoll = canWrite && (conv?.allowsPolls ?? false);

    final liveForBar = messagesAsync.value ?? const <ChatMessage>[];

    return ViroScaffold(
      appBar: ChatThreadAppBar(
        title: title,
        searchOpen: _searchOpen,
        searchController: _searchController,
        isAdminOnly: isAdminOnly,
        clubId: widget.clubId,
        conversation: conv,
        state: state,
        members: members,
        mergedMessages: _mergedMessages(liveForBar),
        onToggleSearch: () {
          setState(() {
            _searchOpen = !_searchOpen;
            if (!_searchOpen) {
              _searchController.clear();
              _searchQuery = '';
            }
          });
        },
        onToggleMute: () => _toggleMute(state),
        onToggleFavorite: () => _toggleFavorite(state),
        onRename: () {
          if (conv != null) _rename(conv);
        },
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
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (_, _) =>
                      Center(child: Text(AppCopy.chat.loadError)),
                  data: (liveMessages) {
                    final messages = _mergedMessages(liveMessages);
                    if (messages.isEmpty && liveMessages.isEmpty) {
                      return const SizedBox.expand();
                    }
                    final isGroup = conv?.isGroup ?? false;
                    // Ferme le popup si le message a disparu / plus de réactions.
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
                      // Ignore les messages du viewer (pas de séparateur sur ses envois).
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
                        GestureDetector(
                          behavior: HitTestBehavior.deferToChild,
                          onTap: _dismissReactorsPopup,
                          child: ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(
                              horizontal: ViroSpacing.screenHorizontal,
                              vertical: ViroSpacing.sm,
                            ),
                            itemCount: messages.length + (showLoadMore ? 1 : 0),
                            itemBuilder: (context, index) {
                              if (showLoadMore && index == 0) {
                                return Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: ViroSpacing.sm,
                                  ),
                                  child: Center(
                                    child: _loadingOlder
                                        ? const SizedBox(
                                            width: 24,
                                            height: 24,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : TextButton(
                                            onPressed: () =>
                                                _loadOlderMessages(messages),
                                            child: Text(
                                              AppCopy.chat.loadOlderMessages,
                                            ),
                                          ),
                                  ),
                                );
                              }
                              final messageIndex =
                                  showLoadMore ? index - 1 : index;
                              final message = messages[messageIndex];
                              return ChatThreadMessageTile(
                                message: message,
                                previousCreatedAt: messageIndex == 0
                                    ? null
                                    : messages[messageIndex - 1].createdAt,
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
                                        messageIndex == firstUnreadIndex,
                                searchOpen: _searchOpen,
                                searchQuery: _searchQuery,
                                clubId: widget.clubId,
                                conversationId: widget.conversationId,
                                participantCount:
                                    conv?.participantUids.length ?? 0,
                                reactorsMessageId: _reactorsMessageId,
                                onShowActions: _showMessageActions,
                                onReact: _react,
                                onOpenReactors: _showReactionReactors,
                                onDismissReactors: _dismissReactorsPopup,
                                onVotePoll: _votePoll,
                              );
                            },
                          ),
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
