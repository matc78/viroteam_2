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
