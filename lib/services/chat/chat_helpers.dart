import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Complète [members] avec une fiche par profil de [profiles] dont l’uid n’a pas
/// de fiche lisible (parent : `list` members refusé ; participant sans fiche).
///
/// Une fiche membre lisible reste prioritaire sur le profil dénormalisé.
List<ClubMember> chatMembersWithProfiles({
  required List<ClubMember> members,
  required Map<String, ChatParticipantProfile> profiles,
}) {
  if (profiles.isEmpty) return members;
  final knownUids = {
    for (final member in members)
      if (member.accountUid != null) member.accountUid!,
  };
  final fromProfiles = [
    for (final entry in profiles.entries)
      if (!knownUids.contains(entry.key))
        ClubMember(
          memberId: entry.key,
          accountUid: entry.key,
          role: entry.value.role,
          status: 'active',
          firstName: trimToNull(entry.value.firstName),
          lastName: trimToNull(entry.value.lastName),
          displayName: trimToNull(entry.value.displayName),
          avatarUrl: entry.value.avatarUrl,
          hasLinkedAccount: true,
        ),
  ];
  if (fromProfiles.isEmpty) return members;
  return [...members, ...fromProfiles];
}

/// Tronque [text] à [maxLength] caractères avec une ellipsis si nécessaire.
String truncateChatText(String text, {required int maxLength}) {
  if (text.length <= maxLength) return text;
  return '${text.substring(0, maxLength - 3)}…';
}

/// Retourne une version trimmée de [value], ou `null` si vide.
String? trimToNull(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Champs Firestore communs pour une citation de message.
Map<String, dynamic> buildReplyFields({
  required String? replyToMessageId,
  required String? replyToText,
  required String? replyToSenderUid,
}) {
  final replyId = trimToNull(replyToMessageId);
  final replyPreview = trimToNull(replyToText);
  final replySender = trimToNull(replyToSenderUid);
  if (replyId == null || replyPreview == null) {
    return const <String, dynamic>{};
  }

  return <String, dynamic>{
    FirestoreFields.replyToMessageId: replyId,
    FirestoreFields.replyToText: truncateChatText(replyPreview, maxLength: 140),
    if (replySender != null) FirestoreFields.replyToSenderUid: replySender,
  };
}

/// Valide une URL download Firebase Storage pour l'avatar d'une conversation.
bool isConversationAvatarDownloadUrl({
  required String clubId,
  required String conversationId,
  required String url,
}) {
  if (url.isEmpty || url.length > 2048) return false;
  final idPattern = RegExp(r'^[A-Za-z0-9_-]+$');
  if (!idPattern.hasMatch(clubId) || !idPattern.hasMatch(conversationId)) {
    return false;
  }

  final encodedPath = 'clubs%2F$clubId%2Fchat%2F$conversationId%2F';
  final pattern = RegExp(
    r'^https://firebasestorage\.googleapis\.com/v0/b/viroteam-75303\.'
    r'(appspot\.com|firebasestorage\.app)/o/'
    '${RegExp.escape(encodedPath)}'
    r'[A-Za-z0-9_-]+%2Favatar\.jpg(\?.*)?$',
  );
  return pattern.hasMatch(url);
}
