import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/announcements/announcement_target_types.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

class AnnouncementService {
  AnnouncementService({FirebaseFirestore? firestore})
      : _db = firestore ?? appFirestore;

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _announcements(String clubId) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.announcementsSubcollection);

  DocumentReference<Map<String, dynamic>> _memberRef(
    String clubId,
    String memberId,
  ) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.membersSubcollection)
          .doc(memberId);

  Stream<List<ClubAnnouncement>> watchAnnouncements({
    required String clubId,
    int limit = 50,
  }) {
    return _announcements(clubId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(limit)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map(
                (d) => ClubAnnouncement.fromFirestore(clubId: clubId, doc: d),
              )
              .toList(),
        );
  }

  /// Annonces lisibles par un parent : « Tous les membres » (+ `all` v1) et
  /// « Équipes » ciblant une équipe de l'enfant (une requête par équipe).
  ///
  /// Pas de lecture globale : les rules refusent les annonces « Catégories »
  /// et « Personnes » à un parent. Tri client (plus récentes d'abord), sans
  /// `orderBy` serveur pour éviter des index composites.
  Stream<List<ClubAnnouncement>> watchAnnouncementsForGuardian({
    required String clubId,
    required List<String> childTeamIds,
    int limit = 50,
  }) {
    final teamIds = childTeamIds.where((id) => id.isNotEmpty).toSet();

    Stream<List<ClubAnnouncement>> mapQuery(
      Query<Map<String, dynamic>> query,
    ) =>
        query.snapshots().map(
              (snap) => snap.docs
                  .map(
                    (d) => ClubAnnouncement.fromFirestore(
                      clubId: clubId,
                      doc: d,
                    ),
                  )
                  .toList(),
            );

    final streams = <Stream<List<ClubAnnouncement>>>[
      mapQuery(
        _announcements(clubId).where(
          FirestoreFields.targetType,
          isEqualTo: AnnouncementTargetTypes.tousLesMembres,
        ),
      ),
      mapQuery(
        _announcements(clubId).where(
          FirestoreFields.targetType,
          isEqualTo: AnnouncementTargetTypes.legacyAll,
        ),
      ),
      for (final teamId in teamIds)
        mapQuery(
          _announcements(clubId)
              .where(
                FirestoreFields.targetType,
                isEqualTo: AnnouncementTargetTypes.equipes,
              )
              .where(FirestoreFields.targetIds, arrayContains: teamId),
        ),
    ];

    return combineLatestListStreams(streams).map(
      (announcements) => mergeGuardianAnnouncements(announcements, limit: limit),
    );
  }

  /// Fusionne les résultats des requêtes parent : dédoublonne par id, trie
  /// par `createdAt` décroissant et tronque à [limit].
  static List<ClubAnnouncement> mergeGuardianAnnouncements(
    List<ClubAnnouncement> announcements, {
    int limit = 50,
  }) {
    final byId = <String, ClubAnnouncement>{};
    for (final announcement in announcements) {
      byId[announcement.id] = announcement;
    }
    final merged = byId.values.toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return merged.take(limit).toList();
  }

  Stream<Set<String>> watchDismissedAnnouncementIds({
    required String clubId,
    required String memberId,
  }) {
    return _memberRef(clubId, memberId).snapshots().map((doc) {
      if (!doc.exists) return <String>{};
      final data = doc.data() ?? {};
      final ids = data[FirestoreFields.dismissedAnnouncementIds]
          as List<dynamic>?;
      return ids?.whereType<String>().toSet() ?? {};
    });
  }

  Future<void> createAnnouncement({
    required String clubId,
    required String senderId,
    required String senderFirstName,
    required String senderLastName,
    required String message,
    required String targetType,
    required List<String> targetIds,
    required DateTime endsAt,
  }) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty) {
      throw ArgumentError('Le message est obligatoire.');
    }
    await _announcements(clubId).add({
      FirestoreFields.senderId: senderId,
      FirestoreFields.senderFirstName: senderFirstName,
      FirestoreFields.senderLastName: senderLastName,
      FirestoreFields.message: trimmed,
      FirestoreFields.targetType: targetType,
      FirestoreFields.targetIds:
          targetType == AnnouncementTargetTypes.tousLesMembres
              ? <String>[]
              : targetIds,
      FirestoreFields.endsAt: Timestamp.fromDate(endsAt),
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
    });
  }

  /// Clôture manuellement une annonce (reste listée côté staff, masquée aux membres).
  Future<void> closeAnnouncement({
    required String clubId,
    required String announcementId,
    required String closedBy,
  }) async {
    await _announcements(clubId).doc(announcementId).update({
      FirestoreFields.closedAt: FieldValue.serverTimestamp(),
      FirestoreFields.closedBy: closedBy,
    });
  }

  Future<void> updateAnnouncement({
    required String clubId,
    required String announcementId,
    required String message,
  }) async {
    await _announcements(clubId).doc(announcementId).update({
      FirestoreFields.message: message.trim(),
    });
  }

  Future<void> deleteAnnouncement({
    required String clubId,
    required String announcementId,
  }) async {
    await _announcements(clubId).doc(announcementId).delete();
  }

  Future<void> dismissAnnouncement({
    required String clubId,
    required String memberId,
    required String announcementId,
  }) async {
    await _memberRef(clubId, memberId).update({
      FirestoreFields.dismissedAnnouncementIds:
          FieldValue.arrayUnion([announcementId]),
    });
  }
}
