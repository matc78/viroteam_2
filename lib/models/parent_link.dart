import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Entrée `users/{uid}.parentLinks[]` — index session, pas un rôle club.
class ParentLink {
  const ParentLink({
    required this.clubId,
    required this.memberId,
    required this.relation,
    required this.status,
  });

  final String clubId;
  final String memberId;
  final String relation;
  final String status;

  /// Lien utilisable pour l’espace famille (pas pending / revoked).
  bool get isActive => status == GuardianStatuses.active;

  /// Parse une entrée `parentLinks[]`.
  factory ParentLink.fromMap(Map<String, dynamic> map) {
    return ParentLink(
      clubId: map[FirestoreFields.clubId] as String? ?? '',
      memberId: map[FirestoreFields.memberId] as String? ?? '',
      relation:
          map[FirestoreFields.relation] as String? ?? GuardianRelations.parent,
      status:
          map[FirestoreFields.status] as String? ?? GuardianStatuses.pending,
    );
  }

  /// Sérialise l’entrée pour Firestore.
  Map<String, dynamic> toMap() => {
        FirestoreFields.clubId: clubId,
        FirestoreFields.memberId: memberId,
        FirestoreFields.relation: relation,
        FirestoreFields.status: status,
      };
}
