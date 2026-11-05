import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/chat/chat_thread_open_seed.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_member_maps.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/chat_service.dart';
import 'package:viro_team_v2/utils/club_color.dart';

/// Identifie un fil : club + conversation.
typedef ChatThreadKey = ({String clubId, String conversationId});

/// État local d’un fil ouvert : historique, envois optimistes, réponse, non-lus.
class ChatThreadState {
  const ChatThreadState({
    this.olderMessages = const [],
    this.pendingMessages = const [],
    this.loadingOlder = false,
    this.hasMoreOlder = true,
    this.replyTo,
    this.editing,
    this.uploadProgress = const {},
    this.unreadSeparator = (count: null, after: null),
  });

  /// Messages plus anciens que la fenêtre live (pages chargées ou sortis du live).
  final List<ChatMessage> olderMessages;

  /// Envois optimistes pas encore confirmés par le stream live.
  final List<ChatMessage> pendingMessages;
  final bool loadingOlder;
  final bool hasMoreOlder;

  /// Message cité par le brouillon en cours.
  final ChatMessage? replyTo;

  /// Message en cours de modification dans le composer.
  final ChatMessage? editing;

  /// Avancement (0 → 1) de l’upload des photos en cours, par id de message.
  final Map<String, double> uploadProgress;

  /// Séparateur « nouveaux messages » figé à l’open.
  final ChatThreadUnreadSeparator unreadSeparator;

  /// Copie modifiée ; [clearReply] retire [replyTo], [clearEditing] retire
  /// [editing].
  ChatThreadState copyWith({
    List<ChatMessage>? olderMessages,
    List<ChatMessage>? pendingMessages,
    bool? loadingOlder,
    bool? hasMoreOlder,
    ChatMessage? replyTo,
    bool clearReply = false,
    ChatMessage? editing,
    bool clearEditing = false,
    Map<String, double>? uploadProgress,
  }) {
    return ChatThreadState(
      olderMessages: olderMessages ?? this.olderMessages,
      pendingMessages: pendingMessages ?? this.pendingMessages,
      loadingOlder: loadingOlder ?? this.loadingOlder,
      hasMoreOlder: hasMoreOlder ?? this.hasMoreOlder,
      replyTo: clearReply ? null : (replyTo ?? this.replyTo),
      editing: clearEditing ? null : (editing ?? this.editing),
      uploadProgress: uploadProgress ?? this.uploadProgress,
      unreadSeparator: unreadSeparator,
    );
  }
}

/// Contrôleur d’un fil : pagination, envois optimistes et relance, non-lus,
/// actions sur la conversation et les messages.
class ChatThreadController extends Notifier<ChatThreadState> {
  ChatThreadController(this.key);

  final ChatThreadKey key;

  ChatService get _chat => ref.read(chatServiceProvider);

  String? get _uid => ref.read(authStateProvider).value?.uid;

  @override
  ChatThreadState build() {
    ref.listen(chatMessagesProvider(key), _onLiveMessages);
    final viewerUid = _uid;
    final states = ref.read(chatStatesProvider).value ?? const {};
    final state = states[ChatUserState.docId(key.clubId, key.conversationId)];
    return ChatThreadState(
      unreadSeparator: chatThreadUnreadSeparator(
        conversation: _inboxConversation(),
        state: state,
        viewerUid: viewerUid,
      ),
    );
  }

  ChatConversation? _inboxConversation() {
    final inbox = ref.read(chatInboxProvider).value ?? const [];
    for (final entry in inbox) {
      if (entry.clubId == key.clubId && entry.id == key.conversationId) {
        return entry;
      }
    }
    return null;
  }

  /// Garde l’historique qui sort du live, retire les optimistes confirmés et
  /// marque lu à chaque nouveau message (rafraîchit `lastReadAt` pour les push).
  void _onLiveMessages(
    AsyncValue<List<ChatMessage>>? previous,
    AsyncValue<List<ChatMessage>> next,
  ) {
    final messages = next.asData?.value;
    if (messages == null) return;
    final previousMessages = previous?.asData?.value;
    final dropped = chatThreadMessagesLeavingLiveWindow(
      previous: previousMessages,
      next: messages,
      older: state.olderMessages,
      pageSize: ChatService.messagePageSize,
    );
    final liveIds = {for (final message in messages) message.id};
    final remaining = state.pendingMessages
        .where((pending) => !liveIds.contains(pending.id))
        .toList(growable: false);
    if (dropped.isNotEmpty ||
        remaining.length != state.pendingMessages.length) {
      state = state.copyWith(
        olderMessages: [...dropped, ...state.olderMessages],
        pendingMessages: remaining,
      );
    }
    final previousLastId = (previousMessages == null || previousMessages.isEmpty)
        ? null
        : previousMessages.last.id;
    final lastId = messages.isEmpty ? null : messages.last.id;
    if (lastId != null && lastId != previousLastId) markRead();
  }

  /// Remet les non-lus du fil à zéro pour l’utilisateur connecté.
  Future<void> markRead() async {
    final uid = _uid;
    if (uid == null) return;
    await _chat.markRead(
      uid: uid,
      clubId: key.clubId,
      conversationId: key.conversationId,
    );
  }

  /// Charge la page d’historique précédant le plus ancien message affiché.
  ///
  /// Retourne `false` si le chargement a échoué (sinon `true`, y compris
  /// quand il n’y avait rien à charger).
  Future<bool> loadOlder() async {
    if (state.loadingOlder || !state.hasMoreOlder) return true;
    final merged = mergeChatThreadMessages(
      older: state.olderMessages,
      live: ref.read(chatMessagesProvider(key)).value ?? const [],
      pending: state.pendingMessages,
    );
    if (merged.isEmpty) return true;
    state = state.copyWith(loadingOlder: true);
    try {
      final older = await _chat.fetchOlderMessages(
        clubId: key.clubId,
        conversationId: key.conversationId,
        beforeMessageId: merged.first.id,
      );
      if (!ref.mounted) return true;
      if (older.isEmpty) {
        state = state.copyWith(hasMoreOlder: false, loadingOlder: false);
        return true;
      }
      final existingIds = {for (final message in merged) message.id};
      final fresh = older
          .where((message) => !existingIds.contains(message.id))
          .toList();
      state = state.copyWith(
        olderMessages: [...fresh, ...state.olderMessages],
        hasMoreOlder: older.length >= ChatService.messagePageSize,
        loadingOlder: false,
      );
      return true;
    } catch (_) {
      if (ref.mounted) state = state.copyWith(loadingOlder: false);
      return false;
    }
  }

  /// Cite [message] dans le prochain envoi (annule une modification en cours).
  void setReplyTo(ChatMessage message) {
    state = state.copyWith(replyTo: message, clearEditing: true);
  }

  /// Passe le composer en modification de [message] (annule la citation).
  void startEditing(ChatMessage message) {
    if (!canEdit(message)) return;
    state = state.copyWith(editing: message, clearReply: true);
  }

  /// Quitte le mode modification.
  void cancelEditing() {
    if (state.editing == null) return;
    state = state.copyWith(clearEditing: true);
  }

  /// Enregistre [text] comme nouveau texte du message en modification.
  ///
  /// Texte vide ou inchangé : quitte simplement le mode modification.
  Future<void> submitEdit(String text) async {
    final editing = state.editing;
    if (editing == null) return;
    state = state.copyWith(clearEditing: true);
    final next = text.trim();
    if (next.isEmpty || next == (editing.text ?? '').trim()) return;
    await editMessage(editing, next);
  }

  /// Annule la citation en cours.
  void clearReply() {
    if (state.replyTo == null) return;
    state = state.copyWith(clearReply: true);
  }

  /// Ajoute un texte optimiste (avec la citation en cours) et le retourne,
  /// à passer à [deliver]. `null` si personne n’est connecté.
  ChatMessage? enqueueText(String text) => _enqueue(text: text);

  /// Ajoute une photo optimiste (avec la citation en cours) et la retourne,
  /// à passer à [deliver]. `null` si personne n’est connecté.
  ChatMessage? enqueueImage(Uint8List bytes) => _enqueue(imageBytes: bytes);

  ChatMessage? _enqueue({String? text, Uint8List? imageBytes}) {
    final uid = _uid;
    if (uid == null) return null;
    final pending = chatThreadPendingMessage(
      id: _chat.allocateMessageId(
        clubId: key.clubId,
        conversationId: key.conversationId,
      ),
      clubId: key.clubId,
      conversationId: key.conversationId,
      senderUid: uid,
      createdAt: DateTime.now(),
      text: text,
      imageBytes: imageBytes,
      replyTo: state.replyTo,
    );
    state = state.copyWith(
      pendingMessages: [...state.pendingMessages, pending],
      clearReply: true,
    );
    return pending;
  }

  /// Envoie (ou relance) l’optimiste [pending] puis marque lu.
  ///
  /// Retourne `false` en cas d’échec : le message passe alors en « échec ».
  Future<bool> deliver(ChatMessage pending) async {
    if (_uid == null) return true;
    final meta = _senderMeta();
    _setPendingStatus(pending.id, ChatMessageLocalStatus.sending);
    try {
      await _chat.sendPendingMessage(
        pending,
        senderFirstName: meta.firstName,
        senderRole: meta.senderRole,
        onProgress: pending.type == ChatMessageTypes.image
            ? (progress) => _setUploadProgress(pending.id, progress)
            : null,
      );
      await markRead();
      return true;
    } catch (_) {
      if (ref.mounted) {
        _setPendingStatus(pending.id, ChatMessageLocalStatus.failed);
      }
      return false;
    } finally {
      if (ref.mounted) _setUploadProgress(pending.id, null);
    }
  }

  /// Met à jour (ou retire si `null`) l’avancement de l’upload de [messageId].
  void _setUploadProgress(String messageId, double? progress) {
    if (!ref.mounted) return;
    final current = state.uploadProgress;
    if (progress == null && !current.containsKey(messageId)) return;
    state = state.copyWith(
      uploadProgress: {
        for (final entry in current.entries)
          if (entry.key != messageId) entry.key: entry.value,
        if (progress != null) messageId: progress,
      },
    );
  }

  void _setPendingStatus(String messageId, ChatMessageLocalStatus status) {
    final index =
        state.pendingMessages.indexWhere((message) => message.id == messageId);
    if (index < 0 || state.pendingMessages[index].localStatus == status) {
      return;
    }
    state = state.copyWith(
      pendingMessages: [
        for (final message in state.pendingMessages)
          message.id == messageId
              ? message.copyWith(localStatus: status)
              : message,
      ],
    );
  }

  ({String firstName, String senderRole}) _senderMeta() {
    final user = ref.read(viroUserProvider).value;
    final clubs = ref.read(userClubsProvider).value ?? const [];
    final membership = clubs
        .where((entry) => entry.club.id == key.clubId)
        .map((entry) => entry.membership)
        .firstOrNull;
    final firstName = (user?.firstName.trim().isNotEmpty == true)
        ? user!.firstName.trim()
        : (user?.displayName.trim().split(RegExp(r'\s+')).firstOrNull ?? '');
    return (firstName: firstName, senderRole: membership?.role ?? 'parent');
  }

  /// Vote pour [optionId] ; `false` si l’écriture a échoué.
  Future<bool> votePoll(ChatMessage message, String optionId) async {
    final uid = _uid;
    if (uid == null) return true;
    try {
      await _chat.votePollOption(
        clubId: key.clubId,
        conversationId: key.conversationId,
        messageId: message.id,
        optionId: optionId,
        uid: uid,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Bascule la sourdine d’après l’état actuel [userState].
  Future<void> toggleMute(ChatUserState? userState) async {
    final uid = _uid;
    if (uid == null) return;
    await _chat.setMuted(
      uid: uid,
      clubId: key.clubId,
      conversationId: key.conversationId,
      muted: !(userState?.muted ?? false),
    );
  }

  /// Bascule le favori d’après l’état actuel [userState].
  Future<void> toggleFavorite(ChatUserState? userState) async {
    final uid = _uid;
    if (uid == null) return;
    await _chat.setFavorite(
      uid: uid,
      clubId: key.clubId,
      conversationId: key.conversationId,
      favorite: !(userState?.favorite ?? false),
    );
  }

  /// Renomme la conversation pour tous ses participants.
  Future<void> rename(String title) {
    return _chat.renameConversation(
      clubId: key.clubId,
      conversationId: key.conversationId,
      titleOverride: title,
    );
  }

  /// Upload [bytes] comme avatar du groupe ; `false` en cas d’échec.
  ///
  /// [fileName] sert à déduire le type MIME (png / webp / jpeg).
  Future<bool> updateGroupAvatar(Uint8List bytes, {required String fileName}) async {
    final uid = _uid;
    if (uid == null) return true;
    final lower = fileName.toLowerCase();
    final contentType = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
    try {
      final avatarUrl =
          await ref.read(conversationAvatarStorageProvider).uploadAvatar(
                clubId: key.clubId,
                conversationId: key.conversationId,
                uid: uid,
                bytes: bytes,
                contentType: contentType,
              );
      await _chat.updateConversationAvatar(
        clubId: key.clubId,
        conversationId: key.conversationId,
        avatarUrl: avatarUrl,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Supprime (soft delete) [message] au nom de l’utilisateur connecté.
  Future<void> deleteMessage(ChatMessage message) async {
    final uid = _uid;
    if (uid == null) return;
    await _chat.softDeleteMessage(
      clubId: key.clubId,
      conversationId: key.conversationId,
      messageId: message.id,
      deletedByUid: uid,
    );
  }

  /// `true` si l’utilisateur connecté peut modifier [message] (son texte).
  bool canEdit(ChatMessage message) {
    final uid = _uid;
    return uid != null &&
        message.senderUid == uid &&
        message.type == ChatMessageTypes.text;
  }

  /// Remplace le texte de [message] par [text].
  Future<void> editMessage(ChatMessage message, String text) {
    return _chat.editTextMessage(
      clubId: key.clubId,
      conversationId: key.conversationId,
      messageId: message.id,
      text: text,
    );
  }

  /// Ajoute ou retire la réaction [emoji] de l’utilisateur sur [message].
  Future<void> react(ChatMessage message, String emoji) async {
    final uid = _uid;
    if (uid == null) return;
    await _chat.toggleReaction(
      clubId: key.clubId,
      conversationId: key.conversationId,
      messageId: message.id,
      emoji: emoji,
      uid: uid,
    );
  }
}

/// Contrôleur d’un fil, vivant tant que l’écran est monté.
final chatThreadControllerProvider = NotifierProvider.autoDispose
    .family<ChatThreadController, ChatThreadState, ChatThreadKey>(
  ChatThreadController.new,
);

/// Messages affichés d’un fil et repères de liste.
class ChatThreadMessagesView {
  const ChatThreadMessagesView({
    required this.messages,
    required this.showLoadMore,
    required this.loadingOlder,
    required this.groupPositions,
    this.uploadProgress = const {},
    this.firstUnreadIndex,
  });

  /// Historique + live + optimistes, ordre chronologique.
  final List<ChatMessage> messages;

  /// Place de chaque message de [messages] dans son groupe.
  final List<ChatThreadGroupPosition> groupPositions;

  /// Avancement des uploads photo en cours, par id de message.
  final Map<String, double> uploadProgress;

  /// Bouton « Charger plus » en haut du fil.
  final bool showLoadMore;
  final bool loadingOlder;

  /// Index (dans [messages]) du séparateur « nouveaux messages ».
  final int? firstUnreadIndex;
}

/// Vue des messages d’un fil, dérivée du live et de [chatThreadControllerProvider].
final chatThreadMessagesViewProvider = Provider.autoDispose
    .family<AsyncValue<ChatThreadMessagesView>, ChatThreadKey>((ref, key) {
  final live = ref.watch(chatMessagesProvider(key));
  final thread = ref.watch(chatThreadControllerProvider(key));
  final uid = ref.watch(authStateProvider).value?.uid;
  return live.whenData((liveMessages) {
    final messages = mergeChatThreadMessages(
      older: thread.olderMessages,
      live: liveMessages,
      pending: thread.pendingMessages,
    );
    final firstUnreadIndex = chatThreadFirstUnreadIndex(
      messages: messages,
      viewerUid: uid,
      separator: thread.unreadSeparator,
    );
    return ChatThreadMessagesView(
      messages: messages,
      // Fenêtre live non pleine et rien chargé avant : tout l’historique est là.
      showLoadMore: thread.hasMoreOlder &&
          messages.isNotEmpty &&
          (liveMessages.length >= ChatService.messagePageSize ||
              thread.olderMessages.isNotEmpty),
      loadingOlder: thread.loadingOlder,
      groupPositions: chatThreadGroupPositions(
        messages,
        firstUnreadIndex: firstUnreadIndex,
      ),
      uploadProgress: thread.uploadProgress,
      firstUnreadIndex: firstUnreadIndex,
    );
  });
});

/// Fil + chrome passé à l’open depuis l’inbox (titre / avatar immédiats).
typedef ChatThreadChromeKey = ({
  String clubId,
  String conversationId,
  ChatThreadOpenSeed? seed,
});

/// En-tête et droits d’écriture d’un fil.
class ChatThreadChrome {
  const ChatThreadChrome({
    required this.conversation,
    required this.userState,
    required this.members,
    required this.title,
    required this.avatarInitial,
    required this.avatarUrl,
    required this.clubColor,
    required this.isGroup,
    required this.isChannel,
    required this.isAdminOnly,
    required this.readonlyHint,
    required this.canWrite,
    required this.canPoll,
    required this.nameByUid,
    required this.memberByUid,
  });

  /// Conversation live, ou celle de l’inbox tant que le live n’a pas répondu.
  final ChatConversation? conversation;
  final ChatUserState? userState;
  final List<ClubMember> members;

  /// Prénom et fiche par uid (bulles, réactions), viewer inclus.
  final Map<String, String> nameByUid;
  final Map<String, ClubMember> memberByUid;
  final String title;
  final String avatarInitial;
  final String? avatarUrl;

  /// Couleur du club passée à l’open (`null` = accent du thème).
  final Color? clubColor;
  final bool isGroup;
  final bool isChannel;
  final bool isAdminOnly;

  /// Bandeau « qui peut écrire » d’un canal.
  final String? readonlyHint;
  final bool canWrite;
  final bool canPoll;
}

/// Chrome d’un fil : titre, avatar (pair de DM ou groupe), droits d’écriture.
final chatThreadChromeProvider = Provider.autoDispose
    .family<ChatThreadChrome, ChatThreadChromeKey>((ref, chromeKey) {
  final key = (
    clubId: chromeKey.clubId,
    conversationId: chromeKey.conversationId,
  );
  final seed = chromeKey.seed;
  final uid = ref.watch(authStateProvider).value?.uid;
  final clubs = ref.watch(userClubsProvider).value ?? const [];
  final role = clubs
      .where((entry) => entry.club.id == key.clubId)
      .map((entry) => entry.membership)
      .firstOrNull
      ?.role;
  final states = ref.watch(chatStatesProvider).value ?? const {};
  final userState = states[ChatUserState.docId(key.clubId, key.conversationId)];
  final members = ref.watch(chatThreadMembersProvider(key));
  ChatConversation? conversation = ref.watch(chatConversationProvider(key)).value;
  if (conversation == null) {
    final inbox = ref.watch(chatInboxProvider).value ?? const [];
    for (final entry in inbox) {
      if (entry.clubId == key.clubId && entry.id == key.conversationId) {
        conversation = entry;
        break;
      }
    }
  }
  final dmPeers = ref.watch(chatDmPeersProvider).value ?? const {};
  final peer = chatThreadDmPeer(
    conversation: conversation,
    viewerUid: uid,
    members: members,
    inboxPeer: dmPeers['${key.clubId}|${key.conversationId}'],
    seedAvatarUrl: seed?.avatarUrl,
  );
  final title =
      conversation?.displayTitle(peerDisplayName: peer.displayName) ??
          seed?.title ??
          AppCopy.chat.conversationsTitle;
  final isGroup = conversation?.isGroup ?? seed?.isGroup ?? false;
  final String? avatarUrl;
  if (isGroup) {
    final groupAvatar = conversation?.avatarUrl?.trim();
    final seedAvatar = seed?.avatarUrl?.trim();
    if (groupAvatar != null && groupAvatar.isNotEmpty) {
      avatarUrl = groupAvatar;
    } else if (seedAvatar != null && seedAvatar.isNotEmpty) {
      avatarUrl = seedAvatar;
    } else {
      avatarUrl = null;
    }
  } else {
    avatarUrl = peer.avatarUrl;
  }
  final canWrite = chatThreadCanWrite(conversation, uid, role);
  final lookup = chatThreadMemberLookupMaps(members: members, viewerUid: uid);
  return ChatThreadChrome(
    nameByUid: lookup.nameByUid,
    memberByUid: lookup.memberByUid,
    conversation: conversation,
    userState: userState,
    members: members,
    title: title,
    avatarInitial: seed?.initial ?? avatarInitialFromTitle(title),
    avatarUrl: avatarUrl,
    // Seed de l’inbox, sinon couleur de marque du club (ouverture par notif).
    clubColor: seed?.clubColor ??
        clubAccentColor(
          brandColorHex: clubs
              .where((entry) => entry.club.id == key.clubId)
              .firstOrNull
              ?.club
              .brandColorHex,
          clubId: key.clubId,
        ),
    isGroup: isGroup,
    isChannel: conversation?.isReadonlyForMembers ?? seed?.isChannel ?? false,
    isAdminOnly: conversation?.writePolicy == ChatWritePolicies.adminsOnly,
    readonlyHint: chatThreadReadonlyHint(conversation),
    canWrite: canWrite,
    canPoll: canWrite && (conversation?.allowsPolls ?? false),
  );
});
