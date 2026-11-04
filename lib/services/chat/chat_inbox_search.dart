import 'package:viro_team_v2/models/chat_conversation.dart';

/// Clé `clubId|conversationId` des maps inbox (pairs DM, etc.).
String chatInboxKey(String clubId, String conversationId) =>
    '$clubId|$conversationId';

/// Normalise une saisie de recherche inbox (trim + minuscules).
String normalizeInboxQuery(String raw) => raw.trim().toLowerCase();

/// Filtre [conversations] (ordre conservé) sur [query] déjà normalisée.
///
/// Champs cherchés : titre affiché (nom de l'interlocuteur pour une DM, via
/// [peerNameByKey] indexé par [chatInboxKey]), nom du club ([clubNameById],
/// à défaut l'id), aperçu du dernier message et prénom de son auteur.
/// Requête vide → liste inchangée.
List<ChatConversation> filterInboxConversations(
  List<ChatConversation> conversations, {
  required String query,
  required Map<String, String> clubNameById,
  Map<String, String> peerNameByKey = const {},
}) {
  if (query.isEmpty) return conversations;
  return conversations.where((conv) {
    final haystack = [
      conv.displayTitle(
        peerDisplayName: peerNameByKey[chatInboxKey(conv.clubId, conv.id)],
      ),
      clubNameById[conv.clubId] ?? conv.clubId,
      conv.lastMessagePreview,
      conv.lastSenderFirstName ?? '',
    ].join(' ').toLowerCase();
    return haystack.contains(query);
  }).toList();
}
