import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Demande de changement de rôle (`join_requests/{id}`), envoyée depuis
/// l'écran « Demander un autre rôle » et traitée par un admin du club via la
/// callable `resolveJoinRequest`.
class JoinRequest {
  const JoinRequest({
    required this.id,
    required this.userId,
    required this.clubId,
    required this.roleRequested,
    required this.status,
    this.firstName = '',
    this.lastName = '',
    this.message = '',
    this.createdAt,
  });

  final String id;
  final String userId;
  final String clubId;
  final String roleRequested;
  final String status;
  final String firstName;
  final String lastName;
  final String message;
  final DateTime? createdAt;

  String get fullName => '$firstName $lastName'.trim();

  bool get isPending => status == JoinRequestStatus.pending;

  factory JoinRequest.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const <String, dynamic>{};
    final createdAt = data[FirestoreFields.createdAt];
    return JoinRequest(
      id: doc.id,
      userId: data[FirestoreFields.userId] as String? ?? '',
      clubId: data[FirestoreFields.clubId] as String? ?? '',
      roleRequested: data[FirestoreFields.roleRequested] as String? ?? '',
      status: data[FirestoreFields.status] as String? ??
          JoinRequestStatus.pending,
      firstName: data[FirestoreFields.firstName] as String? ?? '',
      lastName: data[FirestoreFields.lastName] as String? ?? '',
      message: (data[FirestoreFields.message] as String? ?? '').trim(),
      createdAt: createdAt is Timestamp ? createdAt.toDate() : null,
    );
  }
}
