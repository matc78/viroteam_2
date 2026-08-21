import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/announcements/announcement_target_types.dart';

class ClubAnnouncement {
  const ClubAnnouncement({
    required this.id,
    required this.clubId,
    required this.senderId,
    required this.senderFirstName,
    required this.senderLastName,
    required this.message,
    required this.createdAt,
    this.targetType = AnnouncementTargetTypes.tousLesMembres,
    this.targetIds = const [],
    this.endsAt,
    this.closedAt,
  });

  final String id;
  final String clubId;
  final String senderId;
  final String senderFirstName;
  final String senderLastName;
  final String message;
  final DateTime createdAt;
  final String targetType;
  final List<String> targetIds;
  final DateTime? endsAt;
  final DateTime? closedAt;

  String get authorName => '$senderFirstName $senderLastName'.trim();

  bool get isBroadcast =>
      targetType == AnnouncementTargetTypes.tousLesMembres ||
      targetType == 'all';

  /// Annonce encore visible pour les destinataires (ni clôturée ni expirée).
  bool get isActive {
    if (closedAt != null) return false;
    final limit = endsAt;
    if (limit != null && !limit.isAfter(DateTime.now())) return false;
    return true;
  }

  bool matchesMember({
    required String memberId,
    required List<String> memberTeamIds,
    required Set<String> memberCategories,
  }) {
    switch (targetType) {
      case AnnouncementTargetTypes.tousLesMembres:
      case 'all':
        return true;
      case AnnouncementTargetTypes.equipes:
        if (targetIds.isEmpty) return false;
        return targetIds.any((id) => memberTeamIds.contains(id));
      case AnnouncementTargetTypes.categories:
        if (targetIds.isEmpty) return false;
        return targetIds.any((c) => memberCategories.contains(c));
      case AnnouncementTargetTypes.personnes:
        if (targetIds.isEmpty) return false;
        return targetIds.contains(memberId);
      default:
        return false;
    }
  }

  String targetLabel({Map<String, String>? teamNamesById}) {
    switch (targetType) {
      case AnnouncementTargetTypes.tousLesMembres:
      case 'all':
        return 'Tout le club';
      case AnnouncementTargetTypes.equipes:
        if (targetIds.isEmpty) return 'Équipes';
        if (targetIds.length == 1 && teamNamesById != null) {
          return teamNamesById[targetIds.first] ?? '1 équipe';
        }
        return '${targetIds.length} équipe${targetIds.length > 1 ? 's' : ''}';
      case AnnouncementTargetTypes.categories:
        if (targetIds.isEmpty) return 'Catégories';
        if (targetIds.length == 1) return targetIds.first;
        return '${targetIds.length} catégories';
      case AnnouncementTargetTypes.personnes:
        if (targetIds.isEmpty) return 'Personnes';
        if (targetIds.length == 1) return '1 personne';
        return '${targetIds.length} personnes';
      default:
        return targetType;
    }
  }

  factory ClubAnnouncement.fromFirestore({
    required String clubId,
    required DocumentSnapshot<Map<String, dynamic>> doc,
  }) {
    final data = doc.data() ?? {};
    return ClubAnnouncement(
      id: doc.id,
      clubId: clubId,
      senderId: data[FirestoreFields.senderId] as String? ?? '',
      senderFirstName:
          data[FirestoreFields.senderFirstName] as String? ?? '',
      senderLastName: data[FirestoreFields.senderLastName] as String? ?? '',
      message: data[FirestoreFields.message] as String? ?? '',
      createdAt:
          (data[FirestoreFields.createdAt] as Timestamp?)?.toDate() ??
              DateTime.now(),
      targetType: data[FirestoreFields.targetType] as String? ??
          AnnouncementTargetTypes.tousLesMembres,
      targetIds: (data[FirestoreFields.targetIds] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      endsAt: (data[FirestoreFields.endsAt] as Timestamp?)?.toDate(),
      closedAt: (data[FirestoreFields.closedAt] as Timestamp?)?.toDate(),
    );
  }
}
