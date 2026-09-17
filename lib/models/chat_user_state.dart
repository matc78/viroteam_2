import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// État chat local à l’utilisateur (`users/{uid}/chatState/{id}`).
class ChatUserState {
  const ChatUserState({
    required this.id,
    this.muted = false,
    this.favorite = false,
    this.lastReadAt,
    this.unreadCount = 0,
  });

  final String id;
  final bool muted;
  final bool favorite;
  final DateTime? lastReadAt;
  final int unreadCount;

  static String docId(String clubId, String conversationId) =>
      '${clubId}_$conversationId';

  factory ChatUserState.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? {};
    return ChatUserState(
      id: doc.id,
      muted: data[FirestoreFields.muted] as bool? ?? false,
      favorite: data[FirestoreFields.favorite] as bool? ?? false,
      lastReadAt: _asDateTime(data[FirestoreFields.lastReadAt]),
      unreadCount: (data[FirestoreFields.unreadCount] as num?)?.toInt() ?? 0,
    );
  }

  static const ChatUserState empty = ChatUserState(id: '');
}

DateTime? _asDateTime(Object? raw) {
  if (raw is Timestamp) return raw.toDate();
  if (raw is DateTime) return raw;
  return null;
}
