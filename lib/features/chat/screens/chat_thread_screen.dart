import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/chat/screens/poll_votes_screen.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_attach_menu.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_bubble_timestamp.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_day_separator.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_poll_bubble.dart';
import 'package:viro_team_v2/features/chat/widgets/conversation_info_sheet.dart';
import 'package:viro_team_v2/features/chat/widgets/create_poll_sheet.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

const _reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const _heartReactionEmoji = '❤️';

const _extendedReactionEmojis = [
  ..._reactionEmojis,
  '🔥',
  '👏',
  '🙌',
  '💪',
  '🤝',
  '✌️',
  '🤞',
  '👋',
  '🫡',
  '😊',
  '😁',
  '🤣',
  '😅',
  '😉',
  '😍',
  '🥰',
  '😘',
  '😎',
  '🤔',
  '🤨',
  '😐',
  '😴',
  '🤯',
  '😱',
  '😤',
  '😡',
  '🥺',
  '😭',
  '🤗',
  '🤩',
  '🥳',
  '💯',
  '✨',
  '⭐',
  '🎉',
  '✅',
  '❌',
  '⚠️',
  '💙',
  '💚',
  '💛',
  '🧡',
  '💜',
  '🖤',
  '🤍',
  '💔',
  '⚽',
  '🏀',
  '🏐',
  '🏉',
  '🎾',
  '🥇',
  '🏆',
  '🎯',
  '⚡',
  '💡',
  '📌',
  '👀',
  '💬',
  '📣',
];

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
    final effective = _threadEffectiveUnread(
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

  String _senderFirstName(String senderUid, List<ClubMember> members) {
    for (final member in members) {
      if (member.accountUid != senderUid) continue;
      final first = member.firstName?.trim() ?? '';
      if (first.isNotEmpty) return first;
      final display = member.displayName?.trim() ?? '';
      if (display.isNotEmpty) {
        return display.split(RegExp(r'\s+')).first;
      }
    }
    return '';
  }

  /// Prénom + nom pour l’en-tête de bulle en groupe.
  String _senderFullName(String senderUid, List<ClubMember> members) {
    for (final member in members) {
      if (member.accountUid != senderUid) continue;
      final full = member.fullName.trim();
      if (full.isNotEmpty) return full;
      final display = member.displayName?.trim() ?? '';
      if (display.isNotEmpty) return display;
    }
    return '';
  }

  void _setReplyTo(ChatMessage message) {
    setState(() => _replyTo = message);
  }

  void _clearReply() {
    if (_replyTo == null) return;
    setState(() => _replyTo = null);
  }

  String _replyPreviewText(ChatMessage message) {
    if (message.isDeleted) return AppCopy.chat.messageDeleted;
    if (message.type == ChatMessageTypes.image) {
      return AppCopy.chat.photoPreview;
    }
    if (message.isPoll) {
      return message.pollQuestion?.trim().isNotEmpty == true
          ? message.pollQuestion!.trim()
          : AppCopy.chat.pollLabel;
    }
    return (message.text ?? '').trim();
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

  /// Non-lus effectifs à l’open (compteur Firestore ou fallback lastReadAt).
  int _threadEffectiveUnread({
    required ChatConversation? conversation,
    required ChatUserState? state,
    required String? viewerUid,
  }) {
    if (state?.muted == true) return 0;
    if (state != null && state.unreadCount > 0) return state.unreadCount;
    if (conversation == null) return 0;
    final lastAt = conversation.lastMessageAt;
    final lastSender = conversation.lastSenderUid?.trim() ?? '';
    if (lastAt == null || lastSender.isEmpty) return 0;
    if (viewerUid != null && lastSender == viewerUid) return 0;
    final readAt = state?.lastReadAt;
    if (readAt == null) return 1;
    if (lastAt.isAfter(readAt)) return 1;
    return 0;
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
            replyToText: reply == null ? null : _replyPreviewText(reply),
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
            replyToText: reply == null ? null : _replyPreviewText(reply),
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
    final controller = TextEditingController(
      text: conv.displayTitle(peerDisplayName: peerName),
    );
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppCopy.chat.renameConversation),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(hintText: AppCopy.chat.renameHint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(AppCopy.common.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(AppCopy.common.save),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(chatServiceProvider).renameConversation(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          titleOverride: controller.text,
        );
  }

  Future<void> _deleteMessage(ChatMessage message) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppCopy.chat.deleteMessage),
        content: Text(AppCopy.chat.deleteMessageConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(AppCopy.common.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(AppCopy.common.delete),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(chatServiceProvider).softDeleteMessage(
          clubId: widget.clubId,
          conversationId: widget.conversationId,
          messageId: message.id,
          deletedByUid: uid,
        );
  }

  Future<void> _copyMessage(ChatMessage message) async {
    final text = (message.text ?? '').trim();
    if (text.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ViroSnackBar.show(context, AppCopy.chat.messageCopied);
  }

  Future<void> _editMessage(ChatMessage message) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || message.senderUid != uid) return;
    if (message.type != ChatMessageTypes.text) return;
    final controller = TextEditingController(text: message.text ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppCopy.chat.editMessage),
        content: TextField(
          controller: controller,
          autofocus: true,
          minLines: 2,
          maxLines: 6,
          decoration: InputDecoration(hintText: AppCopy.chat.editMessageHint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(AppCopy.common.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(AppCopy.common.save),
          ),
        ],
      ),
    );
    final next = controller.text.trim();
    controller.dispose();
    if (ok != true || next.isEmpty || next == (message.text ?? '').trim()) {
      return;
    }
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
    final canCopy = (message.text ?? '').trim().isNotEmpty &&
        message.type == ChatMessageTypes.text;
    final canEdit = mine &&
        !message.isDeleted &&
        message.type == ChatMessageTypes.text;
    final uid = ref.read(authStateProvider).value?.uid;
    final myEmojis = <String>{
      for (final entry in message.reactions.entries)
        if (uid != null && entry.value.contains(uid)) entry.key,
    };

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!message.isDeleted)
              ListTile(
                leading: ViroIcon(
                  ViroIcons.chat,
                  color: ViroColors.primary600,
                ),
                title: Text(AppCopy.chat.reply),
                onTap: () {
                  Navigator.pop(ctx);
                  _setReplyTo(message);
                },
              ),
            if (canCopy)
              ListTile(
                leading: ViroIcon(
                  ViroIcons.copy,
                  color: ViroColors.primary600,
                ),
                title: Text(AppCopy.chat.copyMessage),
                onTap: () {
                  Navigator.pop(ctx);
                  _copyMessage(message);
                },
              ),
            if (canEdit)
              ListTile(
                leading: ViroIcon(
                  ViroIcons.edit,
                  color: ViroColors.primary600,
                ),
                title: Text(AppCopy.chat.editMessage),
                onTap: () {
                  Navigator.pop(ctx);
                  _editMessage(message);
                },
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.sm,
                ViroSpacing.xs,
                ViroSpacing.sm,
                ViroSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppCopy.chat.reactions,
                    style: Theme.of(ctx).textTheme.labelLarge?.copyWith(
                          color: ViroColors.gray600,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: ViroSpacing.xs),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ..._reactionEmojis.map(
                        (emoji) => _ReactionPickButton(
                          emoji: emoji,
                          selected: myEmojis.contains(emoji),
                          onTap: () {
                            Navigator.pop(ctx);
                            _react(message, emoji);
                          },
                        ),
                      ),
                      InkWell(
                        borderRadius: BorderRadius.circular(999),
                        onTap: () {
                          Navigator.pop(ctx);
                          _showEmojiPicker(message, myEmojis: myEmojis);
                        },
                        child: Container(
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: ViroColors.gray50,
                            border: Border.all(color: ViroColors.gray200),
                          ),
                          child: ViroIcon(
                            ViroIcons.smiley,
                            color: ViroColors.primary600,
                            size: 20,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (mine)
              ListTile(
                leading: ViroIcon(
                  ViroIcons.trash,
                  color: ViroColors.error,
                ),
                title: Text(
                  AppCopy.chat.deleteMessage,
                  style: const TextStyle(color: ViroColors.error),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _deleteMessage(message);
                },
              ),
          ],
        ),
      ),
    );
  }

  /// Grille d’émojis élargie pour réagir au message.
  void _showEmojiPicker(
    ChatMessage message, {
    required Set<String> myEmojis,
  }) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final height = MediaQuery.sizeOf(ctx).height * 0.45;
        return SafeArea(
          child: SizedBox(
            height: height,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ViroSpacing.md,
                    ViroSpacing.sm,
                    ViroSpacing.sm,
                    ViroSpacing.xs,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          AppCopy.chat.moreEmojis,
                          style: Theme.of(ctx).textTheme.titleMedium,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx),
                        icon: ViroIcon(ViroIcons.close),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ViroSpacing.sm,
                      vertical: ViroSpacing.xs,
                    ),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 8,
                      mainAxisSpacing: 4,
                      crossAxisSpacing: 4,
                    ),
                    itemCount: _extendedReactionEmojis.length,
                    itemBuilder: (context, index) {
                      final emoji = _extendedReactionEmojis[index];
                      return _ReactionPickButton(
                        emoji: emoji,
                        selected: myEmojis.contains(emoji),
                        onTap: () {
                          Navigator.pop(ctx);
                          _react(message, emoji);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
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

  /// Prénom affiché pour un uid participant.
  String _reactorNameFor(String uid, List<ClubMember> members) {
    for (final member in members) {
      if (member.accountUid != uid &&
          member.effectiveUid != uid &&
          member.memberId != uid) {
        continue;
      }
      final first = member.preferredFirstName.trim();
      if (first.isNotEmpty && first != 'Enfant') return first;
      final display = member.fullName.trim();
      if (display.isNotEmpty) return display.split(RegExp(r'\s+')).first;
    }
    return 'Parent';
  }

  /// Rôle club (ou parent) de l’expéditeur pour la bordure de bulle.
  String _senderRoleFor(String senderUid, List<ClubMember> members) {
    for (final member in members) {
      if (member.accountUid == senderUid) return member.role;
    }
    // Participant sans fiche membre = parent (lien guardian).
    return 'parent';
  }

  bool _sameCalendarDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  bool _canWrite(ChatConversation? conv, String? uid, String? role) {
    if (conv == null || uid == null) return false;
    if (!conv.participantUids.contains(uid)) return false;
    switch (conv.writePolicy) {
      case ChatWritePolicies.adminsOnly:
        return role == MemberRoles.admin;
      case ChatWritePolicies.coachesAndAdmins:
        return role == MemberRoles.admin || role == MemberRoles.coach;
      default:
        return true;
    }
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
    final canWrite = _canWrite(conv, uid, role);
    final canPoll = canWrite && (conv?.allowsPolls ?? false);

    return ViroScaffold(
      appBar: ViroAppBar(
        title: _searchOpen
            ? TextField(
                controller: _searchController,
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
            : Text(title),
        actions: [
          IconButton(
            tooltip: _searchOpen
                ? AppCopy.common.cancel
                : AppCopy.chat.searchMessagesHint,
            icon: ViroIcon(
              _searchOpen ? ViroIcons.close : ViroIcons.search,
              color: ViroColors.primary600,
            ),
            onPressed: () {
              setState(() {
                _searchOpen = !_searchOpen;
                if (!_searchOpen) {
                  _searchController.clear();
                  _searchQuery = '';
                }
              });
            },
          ),
          if (!_searchOpen && conv != null)
            IconButton(
              tooltip: AppCopy.chat.conversationInfo,
              icon: ViroIcon(ViroIcons.info, color: ViroColors.primary600),
              onPressed: () {
                final live = messagesAsync.value ?? const <ChatMessage>[];
                showConversationInfoSheet(
                  context: context,
                  conversation: conv,
                  state: state,
                  members: members,
                  messages: _mergedMessages(live),
                  onToggleMute: () => _toggleMute(state),
                  onToggleFavorite: () => _toggleFavorite(state),
                  onRename: () => _rename(conv),
                  onOpenImage: (url) =>
                      showChatImageLightbox(context, imageUrl: url),
                );
              },
            ),
          if (isAdminOnly)
            IconButton(
              tooltip: AppCopy.chat.makeAnnouncement,
              icon: ViroIcon(ViroIcons.megaphone, color: ViroColors.primary600),
              onPressed: () => context.push(
                AppRoutes.clubAnnouncementsPath(widget.clubId),
              ),
            ),
          if (!_searchOpen)
            PopupMenuButton<String>(
              icon: ViroIcon(
                ViroIcons.moreVertical,
                color: ViroColors.primary600,
              ),
              onSelected: (value) {
                switch (value) {
                  case 'rename':
                    if (conv != null) _rename(conv);
                  case 'mute':
                    _toggleMute(state);
                  case 'favorite':
                    _toggleFavorite(state);
                  case 'info':
                    if (conv != null) {
                      final live =
                          messagesAsync.value ?? const <ChatMessage>[];
                      showConversationInfoSheet(
                        context: context,
                        conversation: conv,
                        state: state,
                        members: members,
                        messages: _mergedMessages(live),
                        onToggleMute: () => _toggleMute(state),
                        onToggleFavorite: () => _toggleFavorite(state),
                        onRename: () => _rename(conv),
                        onOpenImage: (url) =>
                            showChatImageLightbox(context, imageUrl: url),
                      );
                    }
                }
              },
              itemBuilder: (_) {
                final isMuted = state?.muted ?? false;
                final isFavorite = state?.favorite ?? false;
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
                  error: (_, __) =>
                      Center(child: Text(AppCopy.chat.loadError)),
                  data: (liveMessages) {
                    final messages = _mergedMessages(liveMessages);
                    if (messages.isEmpty && liveMessages.isEmpty) {
                      return const SizedBox.expand();
                    }
                    final isGroup = conv?.isGroup ?? false;
                    final query = _searchQuery.toLowerCase();
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
                              final mine = message.senderUid == uid;
                              final borderColor = chatBubbleBorderForRole(
                                _senderRoleFor(message.senderUid, members),
                              );
                              final nameByUid = <String, String>{
                                for (final member in members)
                                  if (member.accountUid != null)
                                    member.accountUid!: _reactorNameFor(
                                      member.accountUid!,
                                      members,
                                    ),
                              };
                              final memberByUid = <String, ClubMember>{
                                for (final member in members)
                                  if (member.accountUid != null)
                                    member.accountUid!: member,
                              };
                              // Garantit le viewer même si la fiche est
                              // résolue via effectiveUid / retard provider.
                              if (uid != null) {
                                for (final member in members) {
                                  if (member.accountUid == uid ||
                                      member.effectiveUid == uid ||
                                      member.memberId == uid) {
                                    memberByUid[uid] = member;
                                    nameByUid[uid] =
                                        _reactorNameFor(uid, members);
                                    if (member.accountUid != null &&
                                        member.accountUid != uid) {
                                      memberByUid[member.accountUid!] =
                                          member;
                                      nameByUid[member.accountUid!] =
                                          nameByUid[uid]!;
                                    }
                                    break;
                                  }
                                }
                                if (!nameByUid.containsKey(uid)) {
                                  nameByUid[uid] =
                                      _reactorNameFor(uid, members);
                                }
                              }
                              final anchorKey = _anchorKeyFor(message.id);
                              final showDaySeparator = messageIndex == 0 ||
                                  !_sameCalendarDay(
                                    messages[messageIndex - 1].createdAt,
                                    message.createdAt,
                                  );
                              final showUnreadSeparator =
                                  firstUnreadIndex != null &&
                                      messageIndex == firstUnreadIndex;
                              final matchesSearch = query.isEmpty ||
                                  (message.text ?? '')
                                      .toLowerCase()
                                      .contains(query) ||
                                  (message.pollQuestion ?? '')
                                      .toLowerCase()
                                      .contains(query);
                              final showSenderMeta = !mine && isGroup;
                              final senderLabel = showSenderMeta
                                  ? _senderFullName(
                                      message.senderUid,
                                      members,
                                    )
                                  : '';
                              final senderMember =
                                  showSenderMeta
                                      ? memberByUid[message.senderUid]
                                      : null;
                              final replySenderLabel =
                                  message.replyToSenderUid == null
                                      ? ''
                                      : _senderFirstName(
                                          message.replyToSenderUid!,
                                          members,
                                        );
                              final isPollBubble =
                                  message.isPoll && !message.isDeleted;
                              final hasReactionChips = !isPollBubble &&
                                  !message.isDeleted &&
                                  message.reactions.values
                                      .any((uids) => uids.isNotEmpty);
                              const senderAvatarSize = 28.0;
                              final avatarBottomPad =
                                  hasReactionChips ? 20.0 : 4.0;

                              Widget bubble;
                              if (isPollBubble) {
                                bubble = KeyedSubtree(
                                  key: anchorKey,
                                  child: ChatPollBubble(
                                    message: message,
                                    mine: mine,
                                    viewerUid: uid,
                                    memberByUid: memberByUid,
                                    borderColor: borderColor,
                                    senderLabel: senderLabel,
                                    onVote: (optionId) =>
                                        _votePoll(message, optionId),
                                    onLongPress: () => _showMessageActions(
                                      message,
                                      mine: mine,
                                    ),
                                    onViewVotes: () => openPollVotesScreen(
                                      context: context,
                                      clubId: widget.clubId,
                                      conversationId: widget.conversationId,
                                      messageId: message.id,
                                      participantCount:
                                          conv?.participantUids.length ?? 0,
                                    ),
                                  ),
                                );
                              } else {
                                bubble = _MessageBubble(
                                  anchorKey: anchorKey,
                                  message: message,
                                  mine: mine,
                                  viewerUid: uid,
                                  borderColor: borderColor,
                                  senderLabel: senderLabel,
                                  replySenderLabel: replySenderLabel,
                                  highlightQuery:
                                      query.isEmpty ? null : _searchQuery,
                                  isSearchMatch: _searchOpen &&
                                      query.isNotEmpty &&
                                      matchesSearch,
                                  onLongPress: () =>
                                      _showMessageActions(message, mine: mine),
                                  onDoubleTap: () =>
                                      _react(message, _heartReactionEmoji),
                                  onOpenReactors: () {
                                    if (_reactorsMessageId == message.id) {
                                      _dismissReactorsPopup();
                                      return;
                                    }
                                    _showReactionReactors(
                                      message: message,
                                      viewerUid: uid,
                                      nameByUid: nameByUid,
                                      memberByUid: memberByUid,
                                    );
                                  },
                                  onImageTap: () {
                                    final url = message.downloadUrl ??
                                        message.thumbUrl;
                                    if (url == null || url.isEmpty) return;
                                    showChatImageLightbox(
                                      context,
                                      imageUrl: url,
                                    );
                                  },
                                  onReplyTap: message.hasReply
                                      ? () {
                                          final targetId =
                                              message.replyToMessageId;
                                          if (targetId == null) return;
                                          final key =
                                              _messageAnchorKeys[targetId];
                                          final ctx = key?.currentContext;
                                          if (ctx != null) {
                                            Scrollable.ensureVisible(
                                              ctx,
                                              duration: ViroMotion.fast,
                                              alignment: 0.3,
                                            );
                                          }
                                        }
                                      : null,
                                );
                              }

                              final messageRow = showSenderMeta
                                  ? Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Padding(
                                          padding: EdgeInsets.only(
                                            right: ViroSpacing.xs,
                                            bottom: avatarBottomPad,
                                          ),
                                          child: senderMember != null
                                              ? MemberAvatar(
                                                  member: senderMember,
                                                  size: senderAvatarSize,
                                                )
                                              : SizedBox(
                                                  width: senderAvatarSize,
                                                  height: senderAvatarSize,
                                                ),
                                        ),
                                        Flexible(child: bubble),
                                      ],
                                    )
                                  : bubble;

                              return KeyedSubtree(
                                key: ValueKey(message.id),
                                child: Opacity(
                                  opacity: (_searchOpen &&
                                          query.isNotEmpty &&
                                          !matchesSearch)
                                      ? 0.35
                                      : 1,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      if (showDaySeparator)
                                        ChatDaySeparator(
                                          label: formatChatDaySeparator(
                                            message.createdAt,
                                          ),
                                        ),
                                      if (showUnreadSeparator)
                                        ChatUnreadSeparator(
                                          label:
                                              AppCopy.chat.unreadSeparatorLabel,
                                        ),
                                      messageRow,
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        if (reactorsMessage != null &&
                            reactorsMessage.reactions.values
                                .any((uids) => uids.isNotEmpty))
                          _AnchoredReactorsPopup(
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
          if (canWrite && _replyTo != null)
            Material(
              color: ViroColors.primary50,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.screenHorizontal,
                  vertical: ViroSpacing.xs,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${AppCopy.chat.replyTo} ${_senderFirstName(_replyTo!.senderUid, members)}',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: ViroColors.primary600,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          Text(
                            _replyPreviewText(_replyTo!),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: AppCopy.chat.cancelReply,
                      onPressed: _clearReply,
                      icon: ViroIcon(
                        ViroIcons.close,
                        color: ViroColors.primary600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (canWrite)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.xs,
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.sm,
                ),
                child: Row(
                  children: [
                    ChatAttachMenu(
                      enabled: !_sending,
                      showPoll: canPoll,
                      onCamera: () =>
                          _sendPhoto(source: ImageSource.camera),
                      onGallery: () =>
                          _sendPhoto(source: ImageSource.gallery),
                      onPoll: canPoll ? _openPollSheet : null,
                    ),
                    const SizedBox(width: ViroSpacing.xs),
                    Expanded(
                      child: Focus(
                        onKeyEvent: (node, event) {
                          if (event is! KeyDownEvent) {
                            return KeyEventResult.ignored;
                          }
                          if (event.logicalKey != LogicalKeyboardKey.enter &&
                              event.logicalKey != LogicalKeyboardKey.numpadEnter) {
                            return KeyEventResult.ignored;
                          }
                          if (HardwareKeyboard.instance.isShiftPressed) {
                            return KeyEventResult.ignored;
                          }
                          _sendText();
                          return KeyEventResult.handled;
                        },
                        child: TextField(
                          controller: _controller,
                          minLines: 1,
                          maxLines: 6,
                          keyboardType: TextInputType.multiline,
                          textInputAction: TextInputAction.newline,
                          decoration: InputDecoration(
                            hintText: AppCopy.chat.messageHint,
                            filled: true,
                            fillColor: ViroColors.white,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(20),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 10,
                            ),
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _sending ? null : _sendText,
                      icon: ViroIcon(
                        ViroIcons.send,
                        color: ViroColors.primary600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
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
                          _ReactionChip(
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

/// Popup ancré au message : sous le message, ou au-dessus si pas de place.
class _AnchoredReactorsPopup extends StatefulWidget {
  const _AnchoredReactorsPopup({
    required this.stackKey,
    required this.anchorKey,
    required this.message,
    required this.mine,
    required this.viewerUid,
    required this.nameByUid,
    required this.memberByUid,
    required this.onDismiss,
    required this.onAddReaction,
    required this.onToggleReaction,
  });

  final GlobalKey stackKey;
  final GlobalKey anchorKey;
  final ChatMessage message;
  final bool mine;
  final String? viewerUid;
  final Map<String, String> nameByUid;
  final Map<String, ClubMember> memberByUid;
  final VoidCallback onDismiss;
  final VoidCallback onAddReaction;
  final ValueChanged<String> onToggleReaction;

  @override
  State<_AnchoredReactorsPopup> createState() => _AnchoredReactorsPopupState();
}

class _AnchoredReactorsPopupState extends State<_AnchoredReactorsPopup> {
  String _filter = 'all';
  bool _layoutRetryScheduled = false;

  static const double _popupWidth = 280;
  static const double _gap = 8;
  static const double _edge = 8;
  static const double _maxPopupHeight = 280;
  static const double _preferBelowMin = 120;

  @override
  Widget build(BuildContext context) {
    final entries = widget.message.reactions.entries
        .where((e) => e.value.isNotEmpty)
        .toList();
    final total = entries.fold<int>(0, (sum, e) => sum + e.value.length);

    final rows = <({String uid, String emoji})>[];
    for (final entry in entries) {
      if (_filter != 'all' && entry.key != _filter) continue;
      for (final uid in entry.value) {
        rows.add((uid: uid, emoji: entry.key));
      }
    }
    rows.sort((a, b) {
      final aMine =
          widget.viewerUid != null && a.uid == widget.viewerUid ? 0 : 1;
      final bMine =
          widget.viewerUid != null && b.uid == widget.viewerUid ? 0 : 1;
      if (aMine != bMine) return aMine - bMine;
      final aName = widget.nameByUid[a.uid] ?? '';
      final bName = widget.nameByUid[b.uid] ?? '';
      return aName.compareTo(bName);
    });

    final layout = _computeLayout();
    if (layout == null && !_layoutRetryScheduled) {
      _layoutRetryScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _layoutRetryScheduled = false;
        if (mounted) setState(() {});
      });
    }

    // Pas de barrière plein écran : elle bloquait le scroll du fil.
    if (layout == null) return const SizedBox.shrink();

    return Positioned(
      left: layout.left,
      top: layout.top,
      width: _popupWidth,
      child: Material(
        color: ViroColors.white,
        elevation: ViroMotion.elevationMenu,
        shadowColor: ViroColors.primary900.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: layout.maxHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.md,
                  ViroSpacing.md,
                  ViroSpacing.md,
                  ViroSpacing.sm,
                ),
                child: Text(
                  AppCopy.chat.reactionCountLabel(total),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.md,
                ),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: widget.onAddReaction,
                      child: Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: ViroColors.gray200),
                        ),
                        child: ViroIcon(
                          ViroIcons.smiley,
                          color: ViroColors.primary600,
                          size: 20,
                        ),
                      ),
                    ),
                    for (final entry in entries)
                      ChoiceChip(
                        label: Text('${entry.key} ${entry.value.length}'),
                        selected: _filter == entry.key,
                        onSelected: (_) {
                          setState(() {
                            _filter =
                                _filter == entry.key ? 'all' : entry.key;
                          });
                        },
                      ),
                  ],
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              const Divider(height: 1),
              // Flexible : la liste cède si le header + rows dépassent maxHeight.
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  itemCount: rows.length,
                  itemBuilder: (context, index) {
                    final row = rows[index];
                    final mine = widget.viewerUid != null &&
                        row.uid == widget.viewerUid;
                    final firstName = widget.nameByUid[row.uid]?.trim() ?? '';
                    final displayName = mine
                        ? AppCopy.chat.you
                        : (firstName.isNotEmpty
                            ? firstName
                            : AppCopy.common.memberFallback);
                    return ListTile(
                      dense: true,
                      leading: _reactorAvatar(
                        uid: row.uid,
                        firstName: firstName,
                      ),
                      title: Text(
                        displayName,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: mine
                          ? Text(AppCopy.chat.reactionRemoveMine)
                          : null,
                      trailing: Text(
                        row.emoji,
                        style: const TextStyle(fontSize: 22),
                      ),
                      onTap: mine
                          ? () => widget.onToggleReaction(row.emoji)
                          : null,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Avatar : photo si dispo, sinon initiale du prénom (jamais celle de « Vous »).
  Widget _reactorAvatar({
    required String uid,
    required String firstName,
  }) {
    final member = widget.memberByUid[uid];
    final photoUrl = member?.avatarUrl?.trim();
    final hasPhoto = member != null &&
        member.hasLinkedAccount &&
        photoUrl != null &&
        photoUrl.isNotEmpty;

    if (hasPhoto) {
      return MemberAvatar(member: member, size: 36);
    }

    final preferred = member?.preferredFirstName.trim() ?? '';
    final fromMember = preferred.isNotEmpty && preferred != 'Enfant'
        ? preferred
        : (member?.fullName.trim() ?? '');
    final initialSource =
        firstName.isNotEmpty ? firstName : fromMember;
    final initial = initialSource.isNotEmpty
        ? initialSource[0].toUpperCase()
        : '?';

    return CircleAvatar(
      radius: 18,
      backgroundColor: ViroColors.primary100,
      child: Text(
        initial,
        style: const TextStyle(
          color: ViroColors.primary800,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  /// Calcule left/top/maxHeight collés à la bulle (sous ou au-dessus).
  ({double left, double top, double maxHeight})? _computeLayout() {
    final stackContext = widget.stackKey.currentContext;
    final anchorContext = widget.anchorKey.currentContext;
    if (stackContext == null || anchorContext == null) return null;

    final stackBox = stackContext.findRenderObject() as RenderBox?;
    final anchorBox = anchorContext.findRenderObject() as RenderBox?;
    if (stackBox == null ||
        anchorBox == null ||
        !stackBox.attached ||
        !anchorBox.attached ||
        !stackBox.hasSize ||
        !anchorBox.hasSize) {
      return null;
    }

    // Conversion via global → plus fiable que ancestor: sur web.
    final stackOrigin = stackBox.localToGlobal(Offset.zero);
    final anchorOrigin = anchorBox.localToGlobal(Offset.zero);
    final anchorOffset = anchorOrigin - stackOrigin;
    final stackSize = stackBox.size;
    final anchorSize = anchorBox.size;
    final messageBottom = anchorOffset.dy + anchorSize.height;

    if (messageBottom < _edge || anchorOffset.dy > stackSize.height - _edge) {
      return null;
    }

    final spaceBelow = stackSize.height - messageBottom - _gap - _edge;
    final spaceAbove = anchorOffset.dy - _gap - _edge;
    final showBelow =
        spaceBelow >= _preferBelowMin || spaceBelow >= spaceAbove;

    double top;
    double maxHeight;

    if (showBelow) {
      top = messageBottom + _gap;
      if (top < _edge) top = _edge;
      maxHeight =
          (stackSize.height - top - _edge).clamp(72.0, _maxPopupHeight);
    } else {
      maxHeight = spaceAbove.clamp(72.0, _maxPopupHeight);
      top = anchorOffset.dy - _gap - maxHeight;
      if (top < _edge) {
        top = _edge;
        maxHeight =
            (anchorOffset.dy - _gap - top).clamp(72.0, _maxPopupHeight);
      }
    }

    if (maxHeight < 72) return null;

    // Aligne sur la bulle (droite si message à toi, gauche sinon).
    double left = widget.mine
        ? anchorOffset.dx + anchorSize.width - _popupWidth
        : anchorOffset.dx;
    final maxLeft = stackSize.width - _popupWidth - _edge;
    if (maxLeft < _edge) {
      left = _edge;
    } else {
      left = left.clamp(_edge, maxLeft);
    }

    return (left: left, top: top, maxHeight: maxHeight);
  }
}

/// Bouton emoji dans le sélecteur (état sélectionné si ta réaction).
class _ReactionPickButton extends StatelessWidget {
  const _ReactionPickButton({
    required this.emoji,
    required this.selected,
    required this.onTap,
  });

  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: selected
              ? ViroColors.primary400.withValues(alpha: 0.14)
              : Colors.transparent,
          border: Border.all(
            color: selected ? ViroColors.primary400 : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Text(emoji, style: const TextStyle(fontSize: 22)),
      ),
    );
  }
}

/// Chip de réaction sous un message (style WhatsApp).
class _ReactionChip extends StatelessWidget {
  const _ReactionChip({
    required this.emoji,
    required this.count,
    required this.mine,
  });

  final String emoji;
  final int count;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: ViroColors.white,
        border: Border.all(
          color: mine ? ViroColors.primary400 : ViroColors.gray200,
          width: mine ? 1.5 : 1,
        ),
        boxShadow: ViroMotion.floatingShadow(
          opacity: 0.12,
          blur: 10,
          y: 3,
        ),
      ),
      child: Text(
        count > 1 ? '$emoji $count' : emoji,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: ViroColors.gray600,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}
