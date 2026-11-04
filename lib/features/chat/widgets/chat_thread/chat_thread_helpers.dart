import 'dart:typed_data';
import 'dart:ui';

import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Indique si [uid] peut écrire dans [conv] selon [writePolicy] et [role].
bool chatThreadCanWrite(ChatConversation? conv, String? uid, String? role) {
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

/// Bandeau « qui peut écrire » d’un canal, ou `null` si la conversation est ouverte.
String? chatThreadReadonlyHint(ChatConversation? conv) {
  switch (conv?.writePolicy) {
    case ChatWritePolicies.adminsOnly:
      return AppCopy.chat.readonlyHint;
    case ChatWritePolicies.coachesAndAdmins:
      return AppCopy.chat.readonlyHintCoachesAndAdmins;
    default:
      return null;
  }
}

/// Prénom de l’expéditeur pour les aperçus (réponse, etc.).
String chatThreadSenderFirstName(String senderUid, List<ClubMember> members) {
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
String chatThreadSenderFullName(String senderUid, List<ClubMember> members) {
  for (final member in members) {
    if (member.accountUid != senderUid) continue;
    final full = member.fullName.trim();
    if (full.isNotEmpty) return full;
    final display = member.displayName?.trim() ?? '';
    if (display.isNotEmpty) return display;
  }
  return '';
}

/// Texte d’aperçu pour une réponse (supprimé / photo / sondage / texte).
String chatThreadReplyPreviewText(ChatMessage message) {
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

/// Prénom affiché pour un uid participant (réactions).
String chatThreadReactorNameFor(String uid, List<ClubMember> members) {
  for (final member in members) {
    if (member.accountUid != uid &&
        member.effectiveUid != uid &&
        member.memberId != uid) {
      continue;
    }
    final first = member.preferredFirstName.trim();
    if (first.isNotEmpty && first != AppCopy.common.childFallback) {
      return first;
    }
    final display = member.fullName.trim();
    if (display.isNotEmpty) return display.split(RegExp(r'\s+')).first;
  }
  return AppCopy.common.roleParent;
}

/// Rôle club (ou parent) de l’expéditeur pour la bordure de bulle.
String chatThreadSenderRoleFor(String senderUid, List<ClubMember> members) {
  for (final member in members) {
    if (member.accountUid == senderUid) return member.role;
  }
  // Participant sans fiche membre = parent (lien guardian).
  return 'parent';
}

/// True si [a] et [b] tombent le même jour calendaire local.
bool chatThreadSameCalendarDay(DateTime a, DateTime b) {
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

/// Séparateur « nouveaux messages » figé à l’open du fil.
///
/// [count] : nombre de non-lus à remonter depuis la fin ; sinon [after] :
/// premier message d’un autre postérieur à cette date. Les deux `null` =
/// pas de séparateur.
typedef ChatThreadUnreadSeparator = ({int? count, DateTime? after});

/// Calcule le séparateur « nouveaux messages » à l’open (voir
/// [chatThreadEffectiveUnread]) : compteur Firestore, sinon `lastReadAt`.
ChatThreadUnreadSeparator chatThreadUnreadSeparator({
  required ChatConversation? conversation,
  required ChatUserState? state,
  required String? viewerUid,
}) {
  final effective = chatThreadEffectiveUnread(
    conversation: conversation,
    state: state,
    viewerUid: viewerUid,
  );
  if (effective <= 0) return (count: null, after: null);
  if (state != null && state.unreadCount > 0) {
    return (count: state.unreadCount, after: null);
  }
  if (state?.lastReadAt != null) {
    return (count: null, after: state!.lastReadAt);
  }
  return (count: effective, after: null);
}

/// Index (ordre chronologique) du premier message non lu d’un autre que
/// [viewerUid], ou `null` si [separator] ne désigne rien.
int? chatThreadFirstUnreadIndex({
  required List<ChatMessage> messages,
  required String? viewerUid,
  required ChatThreadUnreadSeparator separator,
}) {
  if (messages.isEmpty) return null;
  final count = separator.count;
  final after = separator.after;
  if (count != null && count > 0) {
    final byCount =
        (messages.length - count).clamp(0, messages.length - 1);
    for (var i = byCount; i < messages.length; i++) {
      if (messages[i].senderUid != viewerUid) return i;
    }
    return null;
  }
  if (after != null) {
    for (var i = 0; i < messages.length; i++) {
      final message = messages[i];
      if (message.createdAt.isAfter(after) && message.senderUid != viewerUid) {
        return i;
      }
    }
  }
  return null;
}

/// Fusionne historique + live + envois optimistes, triés par date.
///
/// Le live l’emporte sur l’historique ; un envoi optimiste n’apparaît que
/// tant que son id n’est pas encore arrivé.
List<ChatMessage> mergeChatThreadMessages({
  required List<ChatMessage> older,
  required List<ChatMessage> live,
  required List<ChatMessage> pending,
}) {
  final byId = <String, ChatMessage>{};
  for (final message in older) {
    byId[message.id] = message;
  }
  for (final message in live) {
    byId[message.id] = message;
  }
  for (final message in pending) {
    byId.putIfAbsent(message.id, () => message);
  }
  return byId.values.toList()
    ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
}

/// Messages que l’arrivée d’un nouveau message pousse hors de la fenêtre
/// live ([previous] → [next]) et qu’il faut garder dans l’historique local.
///
/// Fenêtre non pleine (< [pageSize]) : rien n’a pu en sortir (une purge ne
/// doit pas être gardée).
List<ChatMessage> chatThreadMessagesLeavingLiveWindow({
  required List<ChatMessage>? previous,
  required List<ChatMessage> next,
  required List<ChatMessage> older,
  required int pageSize,
}) {
  if (previous == null || previous.isEmpty) return const [];
  if (next.length < pageSize) return const [];
  final oldestLive = next.first.createdAt;
  final knownIds = {
    for (final message in next) message.id,
    for (final message in older) message.id,
  };
  return previous
      .where(
        (message) =>
            !knownIds.contains(message.id) &&
            message.createdAt.isBefore(oldestLive),
      )
      .toList(growable: false);
}

/// Message optimiste (statut « envoi ») affiché avant la confirmation serveur.
///
/// [imageBytes] : photo locale (type image), sinon message texte [text].
/// [replyTo] : message cité, dont l’extrait est figé dans le brouillon.
ChatMessage chatThreadPendingMessage({
  required String id,
  required String clubId,
  required String conversationId,
  required String senderUid,
  required DateTime createdAt,
  String? text,
  Uint8List? imageBytes,
  ChatMessage? replyTo,
}) {
  return ChatMessage(
    id: id,
    clubId: clubId,
    conversationId: conversationId,
    type: imageBytes != null ? ChatMessageTypes.image : ChatMessageTypes.text,
    text: imageBytes != null ? null : text,
    senderUid: senderUid,
    createdAt: createdAt,
    replyToMessageId: replyTo?.id,
    replyToText: replyTo == null ? null : chatThreadReplyPreviewText(replyTo),
    replyToSenderUid: replyTo?.senderUid,
    localStatus: ChatMessageLocalStatus.sending,
    localImageBytes: imageBytes,
  );
}

/// Nom et photo du pair d’un DM : annuaire inbox [inboxPeer] d’abord (photo :
/// puis [seedAvatarUrl] de l’open), sinon fiche membre de l’autre participant.
({String? displayName, String? avatarUrl}) chatThreadDmPeer({
  required ChatConversation? conversation,
  required String? viewerUid,
  required List<ClubMember> members,
  ({String displayName, String? avatarUrl})? inboxPeer,
  String? seedAvatarUrl,
}) {
  String? displayName = inboxPeer?.displayName;
  String? avatarUrl = inboxPeer?.avatarUrl ?? seedAvatarUrl;
  if (displayName != null || conversation == null || viewerUid == null) {
    return (displayName: displayName, avatarUrl: avatarUrl);
  }
  final peerUid = conversation.peerUidFor(viewerUid);
  if (peerUid == null) return (displayName: null, avatarUrl: avatarUrl);
  for (final member in members) {
    if (member.accountUid != peerUid) continue;
    final name = (member.displayName ?? '').trim();
    if (name.isNotEmpty) displayName = name;
    final photo = member.avatarUrl?.trim();
    if (avatarUrl == null && photo != null && photo.isNotEmpty) {
      avatarUrl = photo;
    }
    break;
  }
  return (displayName: displayName, avatarUrl: avatarUrl);
}

/// Place d’un message dans son groupe (messages consécutifs d’une personne).
typedef ChatThreadGroupPosition = ({bool isFirst, bool isLast});

/// `true` si [next] prolonge le groupe de [previous] : même expéditeur, même
/// jour, moins de [ViroChat.messageGroupWindow] d’écart, ni supprimé ni sondage.
bool chatThreadContinuesGroup(ChatMessage previous, ChatMessage next) {
  if (previous.senderUid != next.senderUid) return false;
  if (previous.isDeleted || next.isDeleted) return false;
  if (previous.isPoll || next.isPoll) return false;
  if (!chatThreadSameCalendarDay(previous.createdAt, next.createdAt)) {
    return false;
  }
  return next.createdAt.difference(previous.createdAt).abs() <
      ViroChat.messageGroupWindow;
}

/// Place de chaque message de [messages] (ordre chronologique) dans son
/// groupe ; le séparateur « nouveaux messages » à [firstUnreadIndex] coupe
/// un groupe.
List<ChatThreadGroupPosition> chatThreadGroupPositions(
  List<ChatMessage> messages, {
  int? firstUnreadIndex,
}) {
  bool joined(int index) =>
      index > 0 &&
      index < messages.length &&
      index != firstUnreadIndex &&
      chatThreadContinuesGroup(messages[index - 1], messages[index]);
  return [
    for (var i = 0; i < messages.length; i++)
      (isFirst: !joined(i), isLast: !joined(i + 1)),
  ];
}

/// Ids des messages (ordre chronologique) dont le texte ou la question de
/// sondage contient [query], sans tenir compte de la casse.
List<String> chatThreadSearchMatches(
  List<ChatMessage> messages,
  String query,
) {
  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return const [];
  return [
    for (final message in messages)
      if (!message.isDeleted &&
          ((message.text ?? '').toLowerCase().contains(needle) ||
              (message.pollQuestion ?? '').toLowerCase().contains(needle)))
        message.id,
  ];
}

/// Taille d’affichage d’une photo de [width] × [height] px : largeur fixe,
/// hauteur au ratio (bornée) ; carré tant que les dimensions sont inconnues.
Size chatThreadImageSize({double? width, double? height}) {
  const displayWidth = ViroChat.imageWidth;
  if (width == null || height == null || width <= 0 || height <= 0) {
    return const Size.square(displayWidth);
  }
  final displayHeight = (displayWidth * height / width)
      .clamp(ViroChat.imageMinHeight, ViroChat.imageMaxHeight);
  return Size(displayWidth, displayHeight);
}

/// Non-lus effectifs à l’open (compteur Firestore ou fallback lastReadAt).
int chatThreadEffectiveUnread({
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
