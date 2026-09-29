import 'package:viro_team_v2/constants/firestore_fields.dart';

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
