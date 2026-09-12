import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Types du journal d’activité club (`activity_events`).
abstract final class ClubActivityTypes {
  static const String membersAdded = 'members_added';
  static const String membersRemoved = 'members_removed';
  static const String invitationsSent = 'invitations_sent';
  static const String eventsCreated = 'events_created';
  static const String eventCancelled = 'event_cancelled';
  static const String teamCreated = 'team_created';
  static const String announcementPublished = 'announcement_published';
}

/// Une ligne du journal d’activité club.
class ClubActivityEvent {
  const ClubActivityEvent({
    required this.id,
    required this.type,
    required this.actorUid,
    required this.createdAt,
    this.actorDisplayName = '',
    this.count = 1,
    this.summary = '',
    this.entityIds = const [],
    this.teamId,
    this.eventId,
    this.announcementId,
  });

  final String id;
  final String type;
  final String actorUid;
  final String actorDisplayName;
  final DateTime createdAt;
  final int count;
  final String summary;
  final List<String> entityIds;
  final String? teamId;
  final String? eventId;
  final String? announcementId;

  /// Construit depuis un document Firestore.
  factory ClubActivityEvent.fromFirestore(
    String id,
    DocumentSnapshot<Map<String, dynamic>> snap,
  ) {
    return ClubActivityEvent.fromMap(id, snap.data() ?? const {});
  }

  /// Construit depuis une map Firestore.
  factory ClubActivityEvent.fromMap(String id, Map<String, dynamic> data) {
    final createdRaw = data[FirestoreFields.createdAt];
    final createdAt = createdRaw is Timestamp
        ? createdRaw.toDate()
        : DateTime.fromMillisecondsSinceEpoch(0);
    final entityRaw = data[FirestoreFields.entityIds];
    return ClubActivityEvent(
      id: id,
      type: data[FirestoreFields.type] as String? ?? '',
      actorUid: data[FirestoreFields.actorUid] as String? ?? '',
      actorDisplayName:
          data[FirestoreFields.actorDisplayName] as String? ?? '',
      createdAt: createdAt,
      count: (data[FirestoreFields.count] as num?)?.toInt() ?? 1,
      summary: data[FirestoreFields.summary] as String? ?? '',
      entityIds: entityRaw is List
          ? entityRaw.whereType<String>().toList()
          : const [],
      teamId: data[FirestoreFields.teamId] as String?,
      eventId: data[FirestoreFields.eventId] as String?,
      announcementId: data[FirestoreFields.announcementId] as String?,
    );
  }

  /// Titre affiché dérivé du type + count.
  String get displayTitle => AppCopy.activity.titleForType(type, count);

  /// Détail optionnel (nom, titre d’événement…).
  String? get displayDetail {
    final trimmed = summary.trim();
    if (trimmed.isEmpty) return null;
    return trimmed;
  }
}

/// Payload Firestore pour une entrée `activity_events`.
Map<String, dynamic> clubActivityEventPayload({
  required String type,
  required String actorUid,
  String actorDisplayName = '',
  int count = 1,
  String summary = '',
  List<String>? entityIds,
  String? teamId,
  String? eventId,
  String? announcementId,
}) {
  return {
    FirestoreFields.type: type,
    FirestoreFields.actorUid: actorUid,
    FirestoreFields.actorDisplayName: actorDisplayName,
    FirestoreFields.count: count < 1 ? 1 : count,
    FirestoreFields.summary: summary,
    if (entityIds != null && entityIds.isNotEmpty)
      FirestoreFields.entityIds: entityIds,
    if (teamId != null && teamId.isNotEmpty) FirestoreFields.teamId: teamId,
    if (eventId != null && eventId.isNotEmpty) FirestoreFields.eventId: eventId,
    if (announcementId != null && announcementId.isNotEmpty)
      FirestoreFields.announcementId: announcementId,
  };
}
