import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/models/club_activity_event.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Écriture et lecture du journal d’activité club (`activity_events`).
class ClubActivityService {
  ClubActivityService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _db = firestore ?? appFirestore,
        _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _db;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> _activityCol(String clubId) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.activityEventsSubcollection);

  String? _currentUid() => _auth.currentUser?.uid;

  String _currentDisplayName() {
    final user = _auth.currentUser;
    if (user == null) return '';
    final name = user.displayName?.trim();
    if (name != null && name.isNotEmpty) return name;
    return user.email?.trim() ?? '';
  }

  /// Payload prêt à écrire (avec `createdAt` serveur).
  Map<String, dynamic> buildPayload({
    required String type,
    String? actorUid,
    String? actorDisplayName,
    int count = 1,
    String summary = '',
    List<String>? entityIds,
    String? teamId,
    String? eventId,
    String? announcementId,
  }) {
    final uid = actorUid ?? _currentUid() ?? '';
    return {
      ...clubActivityEventPayload(
        type: type,
        actorUid: uid,
        actorDisplayName: actorDisplayName ?? _currentDisplayName(),
        count: count,
        summary: summary,
        entityIds: entityIds,
        teamId: teamId,
        eventId: eventId,
        announcementId: announcementId,
      ),
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
    };
  }

  /// Ajoute une entrée dans un [WriteBatch] existant.
  void appendToBatch({
    required WriteBatch batch,
    required String clubId,
    required String type,
    String? actorUid,
    String? actorDisplayName,
    int count = 1,
    String summary = '',
    List<String>? entityIds,
    String? teamId,
    String? eventId,
    String? announcementId,
  }) {
    final ref = _activityCol(clubId).doc();
    batch.set(
      ref,
      buildPayload(
        type: type,
        actorUid: actorUid,
        actorDisplayName: actorDisplayName,
        count: count,
        summary: summary,
        entityIds: entityIds,
        teamId: teamId,
        eventId: eventId,
        announcementId: announcementId,
      ),
    );
  }

  /// Ajoute une entrée dans une [Transaction] existante.
  void appendToTransaction({
    required Transaction tx,
    required String clubId,
    required String type,
    String? actorUid,
    String? actorDisplayName,
    int count = 1,
    String summary = '',
    List<String>? entityIds,
    String? teamId,
    String? eventId,
    String? announcementId,
  }) {
    final ref = _activityCol(clubId).doc();
    tx.set(
      ref,
      buildPayload(
        type: type,
        actorUid: actorUid,
        actorDisplayName: actorDisplayName,
        count: count,
        summary: summary,
        entityIds: entityIds,
        teamId: teamId,
        eventId: eventId,
        announcementId: announcementId,
      ),
    );
  }

  /// Écrit une entrée hors batch (après une mutation autonome).
  Future<void> log({
    required String clubId,
    required String type,
    String? actorUid,
    String? actorDisplayName,
    int count = 1,
    String summary = '',
    List<String>? entityIds,
    String? teamId,
    String? eventId,
    String? announcementId,
  }) async {
    await _activityCol(clubId).doc().set(
          buildPayload(
            type: type,
            actorUid: actorUid,
            actorDisplayName: actorDisplayName,
            count: count,
            summary: summary,
            entityIds: entityIds,
            teamId: teamId,
            eventId: eventId,
            announcementId: announcementId,
          ),
        );
  }

  /// Stream chronologique (plus récent d’abord).
  Stream<List<ClubActivityEvent>> watchActivity({
    required String clubId,
    int limit = 50,
  }) {
    return _activityCol(clubId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(limit)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => ClubActivityEvent.fromFirestore(doc.id, doc))
              .toList(),
        );
  }

  /// Charge le journal (plus récent d’abord).
  Future<List<ClubActivityEvent>> listActivity({
    required String clubId,
    int limit = 50,
  }) async {
    final snap = await _activityCol(clubId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(limit)
        .get();
    return snap.docs
        .map((doc) => ClubActivityEvent.fromFirestore(doc.id, doc))
        .toList();
  }
}
