import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

class ClubInvitation {
  const ClubInvitation({
    required this.id,
    required this.clubId,
    required this.code,
    required this.role,
    required this.status,
    this.type = InvitationTypes.member,
    this.memberId,
    this.email,
    this.emailHint,
    this.sentBy,
    this.sentAt,
    this.expiresAt,
    this.acceptedAt,
    this.clubName,
    this.clubSport,
    this.firstName,
    this.lastName,
    this.relation,
  });

  final String id;
  final String clubId;
  final String code;
  final String role;
  final String status;
  final String type;
  final String? memberId;
  final String? email;

  /// E-mail masqué renvoyé par `lookupInvitationByCode` (ex. `m•••@gmail.com`).
  ///
  /// Uniquement pour l'affichage : jamais utilisé pour préremplir un champ.
  final String? emailHint;
  final String? sentBy;
  final DateTime? sentAt;
  final DateTime? expiresAt;
  final DateTime? acceptedAt;
  final String? clubName;
  final String? clubSport;
  final String? firstName;
  final String? lastName;
  final String? relation;

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  bool get isPending =>
      status == InvitationStatus.pending && !isExpired;

  /// Invitation parent (pas un rôle club).
  bool get isGuardian => type == InvitationTypes.guardian;

  ClubInvitation copyWith({
    String? clubName,
    String? clubSport,
    String? firstName,
    String? lastName,
    String? email,
    String? emailHint,
    String? memberId,
    String? type,
    String? relation,
  }) {
    return ClubInvitation(
      id: id,
      clubId: clubId,
      code: code,
      role: role,
      status: status,
      type: type ?? this.type,
      memberId: memberId ?? this.memberId,
      email: email ?? this.email,
      emailHint: emailHint ?? this.emailHint,
      sentBy: sentBy,
      sentAt: sentAt,
      expiresAt: expiresAt,
      acceptedAt: acceptedAt,
      clubName: clubName ?? this.clubName,
      clubSport: clubSport ?? this.clubSport,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      relation: relation ?? this.relation,
    );
  }

  factory ClubInvitation.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    return ClubInvitation._fromData(
      id: doc.id,
      clubId: doc.reference.parent.parent?.id ?? '',
      data: doc.data() ?? {},
    );
  }

  factory ClubInvitation.fromQuery(
    QueryDocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    return ClubInvitation._fromData(
      id: doc.id,
      clubId: doc.reference.parent.parent?.id ?? '',
      data: doc.data(),
    );
  }

  /// Construit une invitation depuis l'objet `invitation` renvoyé par la
  /// callable `lookupInvitationByCode` (dates ISO 8601, e-mail masqué).
  ///
  /// [email] reste `null` : la callable ne renvoie jamais l'e-mail complet.
  factory ClubInvitation.fromLookup(Map<String, dynamic> lookup) {
    final expiresAtRaw = lookup['expiresAt'];
    final expiresAt = expiresAtRaw is String && expiresAtRaw.isNotEmpty
        ? DateTime.tryParse(expiresAtRaw)
        : null;
    final memberIdRaw = lookup[FirestoreFields.memberId];
    final memberId = memberIdRaw is String && memberIdRaw.isNotEmpty
        ? memberIdRaw
        : null;
    return ClubInvitation(
      id: lookup['invitationId'] as String? ?? '',
      clubId: lookup[FirestoreFields.clubId] as String? ?? '',
      code: lookup[FirestoreFields.code] as String? ?? '',
      role: lookup[FirestoreFields.role] as String? ?? MemberRoles.player,
      status:
          lookup[FirestoreFields.status] as String? ?? InvitationStatus.pending,
      type: lookup[FirestoreFields.type] as String? ?? InvitationTypes.member,
      memberId: memberId,
      emailHint: lookup['emailHint'] as String?,
      expiresAt: expiresAt,
      clubName: lookup[FirestoreFields.clubName] as String?,
      clubSport: lookup[FirestoreFields.clubSport] as String?,
      firstName: lookup[FirestoreFields.firstName] as String?,
      lastName: lookup[FirestoreFields.lastName] as String?,
    );
  }

  factory ClubInvitation._fromData({
    required String id,
    required String clubId,
    required Map<String, dynamic> data,
  }) {
    return ClubInvitation(
      id: id,
      clubId: clubId,
      code: data[FirestoreFields.code] as String? ?? '',
      role: data[FirestoreFields.role] as String? ?? MemberRoles.player,
      status:
          data[FirestoreFields.status] as String? ?? InvitationStatus.pending,
      type: data[FirestoreFields.type] as String? ?? InvitationTypes.member,
      memberId: data[FirestoreFields.memberId] as String?,
      email: data[FirestoreFields.email] as String?,
      sentBy: data[FirestoreFields.sentBy] as String?,
      sentAt: (data[FirestoreFields.sentAt] as Timestamp?)?.toDate(),
      expiresAt: (data[FirestoreFields.expiresAt] as Timestamp?)?.toDate(),
      acceptedAt: (data[FirestoreFields.acceptedAt] as Timestamp?)?.toDate(),
      clubName: data[FirestoreFields.clubName] as String?,
      clubSport: data[FirestoreFields.clubSport] as String?,
      firstName: data[FirestoreFields.firstName] as String?,
      lastName: data[FirestoreFields.lastName] as String?,
      relation: data[FirestoreFields.relation] as String?,
    );
  }
}
