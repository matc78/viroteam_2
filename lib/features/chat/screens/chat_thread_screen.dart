import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/chat/chat_thread_open_seed.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/chat/providers/chat_thread_controller.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_anchored_reactors_popup.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_message_actions.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_app_bar.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_composer.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_dialogs.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_jump_button.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_message_list.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_search_navigator.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_skeleton.dart';
import 'package:viro_team_v2/features/chat/widgets/create_poll_sheet.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Thread d’une conversation.
///
/// L’état métier (historique, envois optimistes, non-lus) vit dans
/// [chatThreadControllerProvider] ; l’écran garde le scroll, la recherche et
/// le popup des réactions.
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

  /// Résultats de la recherche (ids, ordre chronologique) et position
  /// sélectionnée (index dans `ids`, -1 = aucun).
  final ValueNotifier<({List<String> ids, int index})> _searchMatchesNotifier =
      ValueNotifier((ids: const [], index: -1));
  final ValueNotifier<String?> _currentSearchMatchNotifier =
      ValueNotifier(null);

  /// Proximité du bas + msgs hors viewport (FAB).
  final ValueNotifier<bool> _isNearBottomNotifier = ValueNotifier(true);
  final ValueNotifier<int> _newBelowCountNotifier = ValueNotifier(0);

  /// Popup « qui a réagi » ancré au message (null = fermé).
  String? _reactorsMessageId;
  String? _reactorsViewerUid;
  Map<String, String> _reactorsNameByUid = const {};
  Map<String, ClubMember> _reactorsMemberByUid = const {};

  /// Après un envoi : recentrer le fil en bas quand le message arrive.
  bool _scrollToBottomAfterSend = false;

  /// Liste peinte seulement après le slide (évite jank pendant drill-in).
  ///
  /// GoRouter + [CustomTransitionPage] : `ModalRoute.animation` est déjà
  /// `completed` au 1er build — on s’appuie donc sur [ViroMotion.drillIn].
  bool _routeTransitionSettled = false;

  static const double _kNearBottomThreshold = 100;

  ChatThreadKey get _key => (
        clubId: widget.clubId,
        conversationId: widget.conversationId,
      );

  ChatThreadChromeKey get _chromeKey => (
        clubId: widget.clubId,
        conversationId: widget.conversationId,
        seed: widget.openSeed,
      );

  ChatThreadController get _thread =>
      ref.read(chatThreadControllerProvider(_key).notifier);

  /// Clé d’ancrage stable pour un message (popup / mesures).
  GlobalKey _anchorKeyFor(String messageId) =>
      _messageAnchorKeys.putIfAbsent(messageId, GlobalKey.new);

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onThreadScroll);
    _searchController.addListener(() {
      final query = _searchController.text.trim();
      if (query == _searchQueryNotifier.value) return;
      _searchQueryNotifier.value = query;
      _refreshSearchMatches(selectLatest: true);
    });
    Future<void>.delayed(ViroMotion.drillIn, _revealMessagesAfterTransition);
  }

  /// Recalcule les résultats de la recherche ; [selectLatest] sélectionne le
  /// plus récent (nouvelle saisie), sinon garde le résultat courant s’il existe.
  void _refreshSearchMatches({bool selectLatest = false}) {
    final messages =
        ref.read(chatThreadMessagesViewProvider(_key)).value?.messages ??
            const <ChatMessage>[];
    final ids = chatThreadSearchMatches(messages, _searchQueryNotifier.value);
    final currentId = _currentSearchMatchNotifier.value;
    var index = selectLatest ? -1 : ids.indexOf(currentId ?? '');
    if (index < 0) index = ids.length - 1;
    _searchMatchesNotifier.value = (ids: ids, index: index);
    final nextId = index >= 0 ? ids[index] : null;
    if (nextId == currentId) return;
    _currentSearchMatchNotifier.value = nextId;
    if (nextId != null && selectLatest) _revealMessage(nextId);
  }

  /// Sélectionne le résultat [delta] crans plus loin (-1 = plus ancien).
  void _stepSearchMatch(int delta) {
    final matches = _searchMatchesNotifier.value;
    final index = matches.index + delta;
    if (index < 0 || index >= matches.ids.length) return;
    _searchMatchesNotifier.value = (ids: matches.ids, index: index);
    _currentSearchMatchNotifier.value = matches.ids[index];
    _revealMessage(matches.ids[index]);
  }

  /// Amène le message [messageId] à l’écran, en faisant défiler le fil tant
  /// que sa bulle n’est pas construite (liste paresseuse).
  Future<void> _revealMessage(String messageId) async {
    final messages =
        ref.read(chatThreadMessagesViewProvider(_key)).value?.messages ??
            const <ChatMessage>[];
    final targetIndex = messages.indexWhere((m) => m.id == messageId);
    if (targetIndex < 0) return;
    for (var attempt = 0; attempt < 40; attempt++) {
      if (!mounted || !_scrollController.hasClients) return;
      final targetContext = _messageAnchorKeys[messageId]?.currentContext;
      if (targetContext != null) {
        await Scrollable.ensureVisible(
          targetContext,
          duration: ViroMotion.fast,
          alignment: 0.5,
        );
        return;
      }
      final builtIndexes = [
        for (final entry in _messageAnchorKeys.entries)
          if (entry.value.currentContext != null)
            messages.indexWhere((m) => m.id == entry.key),
      ].where((i) => i >= 0);
      if (builtIndexes.isEmpty) return;
      final oldestBuilt = builtIndexes.reduce((a, b) => a < b ? a : b);
      final position = _scrollController.position;
      // Fil inversé : remonter dans l’historique = augmenter l’offset.
      final step = position.viewportDimension * 0.8;
      final next = targetIndex < oldestBuilt
          ? position.pixels + step
          : position.pixels - step;
      _scrollController.jumpTo(
        next.clamp(position.minScrollExtent, position.maxScrollExtent),
      );
      await WidgetsBinding.instance.endOfFrame;
    }
  }

  /// Affiche la liste + markRead une fois le slide terminé.
  void _revealMessagesAfterTransition() {
    if (!mounted || _routeTransitionSettled) return;
    setState(() => _routeTransitionSettled = true);
    _thread.markRead();
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

  /// Ferme le clavier (comme WhatsApp : tap ou glissé vers le bas sur le fil).
  void _dismissKeyboard() => FocusManager.instance.primaryFocus?.unfocus();

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

  /// Après un changement de la liste : purge les ancres hors fenêtre et
  /// ferme le popup si son message n’a plus de réactions.
  void _onMessagesViewChanged(List<ChatMessage> messages) {
    final liveIds = {for (final message in messages) message.id};
    _messageAnchorKeys.removeWhere((id, _) => !liveIds.contains(id));
    if (_searchOpenNotifier.value && _searchQueryNotifier.value.isNotEmpty) {
      _refreshSearchMatches();
    }
    final reactorsId = _reactorsMessageId;
    if (reactorsId == null) return;
    final stillHasReactions = messages.any(
      (message) =>
          message.id == reactorsId &&
          message.reactions.values.any((uids) => uids.isNotEmpty),
    );
    if (!stillHasReactions) _dismissReactorsPopup();
  }

  /// Suit l’arrivée des messages : recentre en bas après un envoi ou près du
  /// bas, sinon incrémente le compteur du bouton « derniers messages ».
  void _onLiveMessages(
    AsyncValue<List<ChatMessage>>? previous,
    AsyncValue<List<ChatMessage>> next,
  ) {
    final messages = next.asData?.value;
    if (messages == null) return;
    final previousMessages = previous?.asData?.value;
    final previousLastId = (previousMessages == null || previousMessages.isEmpty)
        ? null
        : previousMessages.last.id;
    final lastId = messages.isEmpty ? null : messages.last.id;
    if (lastId == null || lastId == previousLastId) return;
    final shouldScroll =
        _scrollToBottomAfterSend || _isNearBottomNotifier.value;
    if (!shouldScroll) {
      final uid = ref.read(authStateProvider).value?.uid;
      if (uid == null || messages.last.senderUid != uid) {
        _newBelowCountNotifier.value = _newBelowCountNotifier.value + 1;
      }
      return;
    }
    _scrollToBottomAfterSend = false;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _animateScrollToBottom();
    });
  }

  /// Charge l’historique en gardant la position de lecture.
  Future<void> _loadOlderMessages() async {
    final position =
        _scrollController.hasClients ? _scrollController.position : null;
    final extentBefore = position?.maxScrollExtent ?? 0;
    final pixelsBefore = position?.pixels ?? 0;
    final ok = await _thread.loadOlder();
    if (!mounted) return;
    if (!ok) {
      ViroSnackBar.show(context, AppCopy.chat.loadOlderFailed);
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      final after = _scrollController.position;
      final delta = after.maxScrollExtent - extentBefore;
      if (delta > 0) after.jumpTo(pixelsBefore + delta);
    });
  }

  void _setReplyTo(ChatMessage message) {
    _leaveEditing();
    _thread.setReplyTo(message);
    _composerFocusNode.requestFocus();
  }

  /// Ouvre la modification de [message] dans le composer (texte prérempli).
  void _startEditing(ChatMessage message) {
    if (!_thread.canEdit(message)) return;
    _thread.startEditing(message);
    final text = message.text ?? '';
    _controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
    _composerFocusNode.requestFocus();
  }

  /// Quitte la modification en vidant le champ (le brouillon était le texte
  /// du message modifié).
  void _leaveEditing() {
    if (ref.read(chatThreadControllerProvider(_key)).editing == null) return;
    _thread.cancelEditing();
    _controller.clear();
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

  @override
  void dispose() {
    _scrollController.removeListener(_onThreadScroll);
    _controller.dispose();
    _composerFocusNode.dispose();
    _searchController.dispose();
    _scrollController.dispose();
    _searchQueryNotifier.dispose();
    _searchOpenNotifier.dispose();
    _searchMatchesNotifier.dispose();
    _currentSearchMatchNotifier.dispose();
    _isNearBottomNotifier.dispose();
    _newBelowCountNotifier.dispose();
    super.dispose();
  }

  Future<void> _sendText() async {
    final text = _controller.text.trimRight();
    if (text.trim().isEmpty) return;
    if (ref.read(chatThreadControllerProvider(_key)).editing != null) {
      _controller.clear();
      await _thread.submitEdit(text);
      return;
    }
    final pending = _thread.enqueueText(text);
    if (pending == null) return;
    _controller.clear();
    _composerFocusNode.requestFocus();
    _requestScrollToBottomAfterSend();
    await _deliver(pending);
  }

  Future<void> _sendPhoto({required ImageSource source}) async {
    final file = await ImagePicker().pickImage(
      source: source,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (file == null) return;
    final bytes = Uint8List.fromList(await file.readAsBytes());
    final pending = _thread.enqueueImage(bytes);
    if (pending == null) return;
    _composerFocusNode.requestFocus();
    _requestScrollToBottomAfterSend();
    await _deliver(pending);
  }

  /// Envoie (ou relance) [pending] ; snackbar en cas d’échec.
  Future<void> _deliver(ChatMessage pending) async {
    final ok = await _thread.deliver(pending);
    if (ok || !mounted) return;
    ViroSnackBar.show(
      context,
      pending.type == ChatMessageTypes.image
          ? AppCopy.chat.photoFailed
          : AppCopy.chat.sendFailed,
    );
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
    final ok = await _thread.votePoll(message, optionId);
    if (!ok && mounted) {
      ViroSnackBar.show(context, AppCopy.chat.pollVoteFailed);
    }
  }

  Future<void> _rename(ChatConversation conv) async {
    final peerTitles = ref.read(chatDmPeerTitlesProvider);
    final peerName = peerTitles['${conv.clubId}|${conv.id}'];
    final next = await showChatRenameConversationDialog(
      context: context,
      initialTitle: conv.displayTitle(peerDisplayName: peerName),
    );
    if (next == null) return;
    await _thread.rename(next);
  }

  /// Choisit une source puis upload l’avatar du groupe.
  Future<void> _changeGroupAvatar(ChatConversation conv) async {
    if (!conv.canEditGroupAvatar) return;
    if (ref.read(authStateProvider).value?.uid == null) return;

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) {
        final palette = ctx.viroPalette;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: ViroIcon(
                  ViroIcons.camera,
                  color: palette.accent,
                ),
                title: Text(AppCopy.chat.changeGroupAvatarCamera),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: ViroIcon(
                  ViroIcons.image,
                  color: palette.accent,
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

    final file = await ImagePicker().pickImage(
      source: source,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (file == null || !mounted) return;

    final ok = await _thread.updateGroupAvatar(
      await file.readAsBytes(),
      fileName: file.path,
    );
    if (!mounted) return;
    ViroSnackBar.show(
      context,
      ok
          ? AppCopy.chat.groupAvatarUpdated
          : AppCopy.chat.groupAvatarUploadFailed,
    );
  }

  Future<void> _deleteMessage(ChatMessage message) async {
    if (ref.read(authStateProvider).value?.uid == null) return;
    final ok = await showChatDeleteMessageDialog(context);
    if (!ok) return;
    await _thread.deleteMessage(message);
  }

  void _showMessageActions(ChatMessage message, {required bool mine}) {
    _dismissReactorsPopup();
    showChatMessageActionsSheet(
      context: context,
      message: message,
      mine: mine,
      viewerUid: ref.read(authStateProvider).value?.uid,
      onReply: () => _setReplyTo(message),
      onCopy: () => copyChatMessageText(
        context: context,
        text: message.text ?? '',
      ),
      onEdit: () => _startEditing(message),
      onDelete: () => _deleteMessage(message),
      onReact: (emoji) => _thread.react(message, emoji),
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
      onReact: (emoji) => _thread.react(message, emoji),
    );
  }

  /// Affiche qui a réagi, ancré sous/au-dessus du message (suit le scroll).
  void _showReactionReactors({
    required ChatMessage message,
    required String? viewerUid,
    required Map<String, String> nameByUid,
    required Map<String, ClubMember> memberByUid,
  }) {
    final hasReactions = message.reactions.values.any((e) => e.isNotEmpty);
    if (!hasReactions) return;
    setState(() {
      _reactorsMessageId = message.id;
      _reactorsViewerUid = viewerUid;
      _reactorsNameByUid = Map<String, String>.from(nameByUid);
      _reactorsMemberByUid = Map<String, ClubMember>.from(memberByUid);
    });
  }

  /// Popup des réactions du message ouvert, s’il en a encore.
  Widget? _buildReactorsPopup(List<ChatMessage> messages, String? uid) {
    final reactorsId = _reactorsMessageId;
    if (reactorsId == null) return null;
    final message = messages.where((m) => m.id == reactorsId).firstOrNull;
    if (message == null ||
        !message.reactions.values.any((uids) => uids.isNotEmpty)) {
      return null;
    }
    return ChatAnchoredReactorsPopup(
      stackKey: _messagesStackKey,
      anchorKey: _anchorKeyFor(message.id),
      message: message,
      mine: message.senderUid == uid,
      viewerUid: _reactorsViewerUid,
      nameByUid: _reactorsNameByUid,
      memberByUid: _reactorsMemberByUid,
      scrollController: _scrollController,
      onDismiss: _dismissReactorsPopup,
      onAddReaction: () {
        final viewerUid = _reactorsViewerUid;
        final myEmojis = <String>{
          for (final e in message.reactions.entries)
            if (viewerUid != null && e.value.contains(viewerUid)) e.key,
        };
        _dismissReactorsPopup();
        _showEmojiPicker(message, myEmojis: myEmojis);
      },
      onToggleReaction: (emoji) {
        _dismissReactorsPopup();
        _thread.react(message, emoji);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final uid = ref.watch(authStateProvider).value?.uid;
    ref.listen(chatMessagesProvider(_key), _onLiveMessages);
    ref.listen(chatThreadMessagesViewProvider(_key), (_, next) {
      final messages = next.value?.messages;
      if (messages == null) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _onMessagesViewChanged(messages);
      });
    });
    final chrome = ref.watch(chatThreadChromeProvider(_chromeKey));
    final viewAsync = ref.watch(chatThreadMessagesViewProvider(_key));
    final replyTo = ref.watch(
      chatThreadControllerProvider(_key).select((thread) => thread.replyTo),
    );
    final editing = ref.watch(
      chatThreadControllerProvider(_key)
          .select((thread) => thread.editing != null),
    );
    final conv = chrome.conversation;

    return ViroScaffold(
      fallbackRoute: AppRoutes.conversations,
      appBar: ChatThreadAppBar(
        title: chrome.title,
        avatarInitial: chrome.avatarInitial,
        avatarColor: chrome.clubColor ?? palette.accent,
        avatarUrl: chrome.avatarUrl,
        isGroup: chrome.isGroup,
        isChannel: chrome.isChannel,
        avatarHeroTag: ChatThreadOpenSeed.avatarHeroTag(
          widget.clubId,
          widget.conversationId,
        ),
        searchOpen: _searchOpenNotifier.value,
        searchController: _searchController,
        isAdminOnly: chrome.isAdminOnly,
        clubId: widget.clubId,
        conversation: conv,
        state: chrome.userState,
        members: chrome.members,
        mergedMessages: _routeTransitionSettled
            ? viewAsync.value?.messages ?? const <ChatMessage>[]
            : const <ChatMessage>[],
        onToggleSearch: () {
          setState(() {
            final next = !_searchOpenNotifier.value;
            _searchOpenNotifier.value = next;
            if (!next) {
              _searchController.clear();
              _searchQueryNotifier.value = '';
              _searchMatchesNotifier.value = (ids: const [], index: -1);
              _currentSearchMatchNotifier.value = null;
            }
          });
        },
        onToggleMute: () => _thread.toggleMute(chrome.userState),
        onToggleFavorite: () => _thread.toggleFavorite(chrome.userState),
        onRename: () {
          if (conv != null) _rename(conv);
        },
        onChangeAvatar: conv != null && conv.canEditGroupAvatar
            ? () => _changeGroupAvatar(conv)
            : null,
      ),
      body: Column(
        children: [
          if (chrome.readonlyHint != null)
            Material(
              color: palette.accentSofter,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.screenHorizontal,
                  vertical: ViroSpacing.xs,
                ),
                child: Text(
                  chrome.readonlyHint!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.accent,
                      ),
                ),
              ),
            ),
          ListenableBuilder(
            listenable: Listenable.merge([
              _searchOpenNotifier,
              _searchQueryNotifier,
              _searchMatchesNotifier,
            ]),
            builder: (context, _) {
              if (!_searchOpenNotifier.value ||
                  _searchQueryNotifier.value.isEmpty) {
                return const SizedBox.shrink();
              }
              final matches = _searchMatchesNotifier.value;
              // Comme le portail : 1 = résultat le plus récent.
              return ChatThreadSearchNavigator(
                current: matches.ids.length - matches.index,
                total: matches.ids.length,
                onPrevious: () => _stepSearchMatch(-1),
                onNext: () => _stepSearchMatch(1),
              );
            },
          ),
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: palette.surface,
                    image: DecorationImage(
                      image: AssetImage(ViroChat.threadBackgroundAsset),
                      repeat: ImageRepeat.repeat,
                      alignment: Alignment.topLeft,
                      scale: 2.5,
                      filterQuality: FilterQuality.medium,
                    ),
                  ),
                ),
                ColoredBox(
                  color: palette.background.withValues(alpha: 0.62),
                ),
                // Fil vide / chargement : tap ou glissé vers le bas ferme le
                // clavier (la liste, au-dessus, gère elle-même ces gestes).
                GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: _dismissKeyboard,
                  onVerticalDragUpdate: (details) {
                    if (details.delta.dy > 0) _dismissKeyboard();
                  },
                ),
                viewAsync.when(
                  loading: () => const ChatThreadSkeleton(),
                  error: (_, _) => ViroErrorState(
                    message: AppCopy.chat.threadLoadError,
                    onRetry: () => ref.invalidate(chatMessagesProvider(_key)),
                  ),
                  data: (view) {
                    // Pendant le slide : chrome seul (fond + app bar), pas de ListView.
                    if (!_routeTransitionSettled) {
                      return const SizedBox.expand();
                    }
                    if (view.messages.isEmpty) {
                      return ViroEmptyState(
                        message: AppCopy.chat.emptyThread,
                        hint: chrome.canWrite
                            ? AppCopy.chat.emptyThreadHint
                            : null,
                        icon: ViroIcons.chat,
                      );
                    }
                    final reactorsPopup =
                        _buildReactorsPopup(view.messages, uid);
                    return Stack(
                      key: _messagesStackKey,
                      fit: StackFit.expand,
                      children: [
                        ChatThreadMessageList(
                          view: view,
                          chrome: chrome,
                          clubId: widget.clubId,
                          conversationId: widget.conversationId,
                          viewerUid: uid,
                          scrollController: _scrollController,
                          searchOpen: _searchOpenNotifier,
                          searchQuery: _searchQueryNotifier,
                          currentSearchMatchId: _currentSearchMatchNotifier,
                          anchorKeyFor: _anchorKeyFor,
                          messageAnchorKeys: _messageAnchorKeys,
                          reactorsMessageId: _reactorsMessageId,
                          onLoadOlder: _loadOlderMessages,
                          onDismissReactors: _dismissReactorsPopup,
                          onShowActions: _showMessageActions,
                          onReact: _thread.react,
                          onOpenReactors: _showReactionReactors,
                          onVotePoll: _votePoll,
                          onRetrySend: (message) {
                            if (message.isSendFailed) _deliver(message);
                          },
                          onReply: chrome.canWrite ? _setReplyTo : null,
                        ),
                        ?reactorsPopup,
                        Positioned(
                          right: ViroSpacing.screenHorizontal,
                          bottom: ViroSpacing.md,
                          child: ChatThreadJumpButton(
                            isNearBottom: _isNearBottomNotifier,
                            newBelowCount: _newBelowCountNotifier,
                            onPressed: () {
                              _newBelowCountNotifier.value = 0;
                              _isNearBottomNotifier.value = true;
                              _animateScrollToBottom();
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
          if (chrome.canWrite)
            ChatThreadComposer(
              controller: _controller,
              focusNode: _composerFocusNode,
              canPoll: chrome.canPoll,
              showReplyBar: replyTo != null,
              replyToSenderName: replyTo == null
                  ? ''
                  : chatThreadSenderFirstName(replyTo.senderUid, chrome.members),
              replyPreview:
                  replyTo == null ? '' : chatThreadReplyPreviewText(replyTo),
              onClearReply: _thread.clearReply,
              editing: editing,
              onCancelEdit: _leaveEditing,
              onSend: _sendText,
              onCamera: () => _sendPhoto(source: ImageSource.camera),
              onGallery: () => _sendPhoto(source: ImageSource.gallery),
              onPoll: chrome.canPoll ? _openPollSheet : null,
            ),
        ],
      ),
    );
  }
}
