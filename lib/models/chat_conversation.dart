import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Conversation club (`clubs/{clubId}/conversations/{convId}`).
class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.clubId,
    required this.type,
    required this.title,
    required this.participantUids,
    required this.writePolicy,
    this.systemKey,
    this.teamId,
    this.categoryKey,
    this.titleOverride,
    this.lastMessageAt,
    this.lastMessagePreview = '',
    this.lastSenderUid,
    this.lastSenderFirstName,
    this.lastSenderRole,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String clubId;
  final String type;
  final String title;
  final String? titleOverride;
  final String? systemKey;
  final String? teamId;
  final String? categoryKey;
  final List<String> participantUids;
  final String writePolicy;
  final DateTime? lastMessageAt;
  final String lastMessagePreview;
  final String? lastSenderUid;
  final String? lastSenderFirstName;
  final String? lastSenderRole;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Titre affiché (override si présent).
  String get displayTitle {
    final override = titleOverride?.trim();
    if (override != null && override.isNotEmpty) return override;
    return title;
  }

  bool get isReadonlyForMembers =>
      writePolicy == ChatWritePolicies.adminsOnly ||
      writePolicy == ChatWritePolicies.coachesAndAdmins;

  /// True si ce n’est pas un DM 1:1 (canaux / groupes).
  bool get isGroup {
    if (type == ChatConversationTypes.dm) {
      return participantUids.length > 2;
    }
    return true;
  }

  /// Sondages autorisés uniquement si plus de 2 participants (règles Firestore).
  bool get allowsPolls => participantUids.length > 2;

  factory ChatConversation.fromFirestore({
    required String clubId,
    required DocumentSnapshot<Map<String, dynamic>> doc,
  }) {
    final data = doc.data() ?? {};
    return ChatConversation(
      id: doc.id,
      clubId: clubId,
      type: data[FirestoreFields.type] as String? ?? ChatConversationTypes.team,
      title: data[FirestoreFields.title] as String? ?? '',
      titleOverride: data[FirestoreFields.titleOverride] as String?,
      systemKey: data[FirestoreFields.systemKey] as String?,
      teamId: data[FirestoreFields.teamId] as String?,
      categoryKey: data[FirestoreFields.categoryKey] as String?,
      participantUids: _stringList(data[FirestoreFields.participantUids]),
      writePolicy:
          data[FirestoreFields.writePolicy] as String? ?? ChatWritePolicies.open,
      lastMessageAt: _asDateTime(data[FirestoreFields.lastMessageAt]),
      lastMessagePreview:
          data[FirestoreFields.lastMessagePreview] as String? ?? '',
      lastSenderUid: data[FirestoreFields.lastSenderUid] as String?,
      lastSenderFirstName: data[FirestoreFields.lastSenderFirstName] as String?,
      lastSenderRole: data[FirestoreFields.lastSenderRole] as String?,
      createdAt: _asDateTime(data[FirestoreFields.createdAt]),
      updatedAt: _asDateTime(data[FirestoreFields.updatedAt]),
    );
  }
}

List<String> _stringList(Object? raw) {
  if (raw is! List) return const [];
  return raw
      .whereType<String>()
      .where((id) => id.isNotEmpty)
      .toList(growable: false);
}

DateTime? _asDateTime(Object? raw) {
  if (raw is Timestamp) return raw.toDate();
  if (raw is DateTime) return raw;
  return null;
}
