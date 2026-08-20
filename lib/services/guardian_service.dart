import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/member_guardian.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Callables + lecture du lien parent (même contrat que le portail).
class GuardianService {
  GuardianService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? appFirestore,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> _guardians(
    String clubId,
    String memberId,
  ) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.membersSubcollection)
          .doc(memberId)
          .collection(ProjectConfig.guardiansSubcollection);

  CollectionReference<Map<String, dynamic>> _invitations(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.invitationsSubcollection);

  DocumentReference<Map<String, dynamic>> _memberRef(
    String clubId,
    String memberId,
  ) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.membersSubcollection)
          .doc(memberId);

  /// Charge le parent V1 (0 ou 1) d’une fiche : guardian active/pending, sinon invitation.
  Future<MemberGuardianView> getMemberGuardian({
    required String clubId,
    required String memberId,
  }) async {
    const empty = MemberGuardianView();
    final guardiansSnap = await _guardians(clubId, memberId).get();
    QueryDocumentSnapshot<Map<String, dynamic>>? occupying;
    for (final doc in guardiansSnap.docs) {
      final status = doc.data()[FirestoreFields.status] as String? ?? '';
      if (status == GuardianStatuses.active ||
          status == GuardianStatuses.pending) {
        occupying = doc;
        break;
      }
    }

    if (occupying != null) {
      final statusRaw =
          occupying.data()[FirestoreFields.status] as String? ??
              GuardianStatuses.pending;
      final status = statusRaw == GuardianStatuses.active
          ? GuardianStatuses.active
          : GuardianStatuses.pending;
      String? displayName;
      String? email;
      final userSnap = await _db
          .collection(ProjectConfig.usersCollection)
          .doc(occupying.id)
          .get();
      if (userSnap.exists) {
        final user = userSnap.data()!;
        displayName =
            (user[FirestoreFields.displayName] as String?)?.trim() ?? '';
        if (displayName.isEmpty) {
          displayName =
              '${user[FirestoreFields.firstName] ?? ''} ${user[FirestoreFields.lastName] ?? ''}'
                  .trim();
        }
        if (displayName.isEmpty) displayName = null;
        email = (user[FirestoreFields.email] as String?)?.trim();
        if (email != null && email.isEmpty) email = null;
      }
      return MemberGuardianView(
        parentUid: occupying.id,
        status: status,
        displayName: displayName,
        email: email,
      );
    }

    final invitesSnap = await _invitations(clubId)
        .where(FirestoreFields.memberId, isEqualTo: memberId)
        .where(FirestoreFields.status, isEqualTo: InvitationStatus.pending)
        .get();
    QueryDocumentSnapshot<Map<String, dynamic>>? pendingInvite;
    for (final doc in invitesSnap.docs) {
      final type = doc.data()[FirestoreFields.type] as String? ??
          InvitationTypes.member;
      if (type == InvitationTypes.guardian) {
        pendingInvite = doc;
        break;
      }
    }
    if (pendingInvite == null) return empty;

    final invite = pendingInvite.data();
    final expiresAt =
        (invite[FirestoreFields.expiresAt] as Timestamp?)?.toDate();

    return MemberGuardianView(
      status: GuardianStatuses.pending,
      email: (invite[FirestoreFields.email] as String?)?.trim(),
      invitationId: pendingInvite.id,
      invitationCode: (invite[FirestoreFields.code] as String?)?.trim(),
      expiresAt: expiresAt,
    );
  }

  /// Prénom d’une fiche enfant pour les puces famille.
  Future<String> childFirstName({
    required String clubId,
    required String memberId,
  }) async {
    final snap = await _memberRef(clubId, memberId).get();
    if (!snap.exists) return 'Enfant';
    return ClubMember.fromFirestore(snap).preferredFirstName;
  }

  /// Charge une fiche membre (lecture guardian / RSVP / cotisation).
  Future<ClubMember?> getClubMember({
    required String clubId,
    required String memberId,
  }) async {
    final snap = await _memberRef(clubId, memberId).get();
    if (!snap.exists) return null;
    return ClubMember.fromFirestore(snap);
  }

  /// Invite un parent (e-mail) sur la fiche — admin ou titulaire.
  Future<({String code, String invitationId})> inviteGuardian({
    required String clubId,
    required String memberId,
    required String email,
  }) async {
    final callable = _functions.httpsCallable('inviteGuardian');
    final response = await callable.call<Map<String, dynamic>>({
      'clubId': clubId,
      'memberId': memberId,
      'email': email.trim(),
    });
    final data = response.data;
    return (
      code: data['code'] as String? ?? '',
      invitationId: data['invitationId'] as String? ?? '',
    );
  }

  /// Active le lien parent pour l’adulte connecté.
  Future<({String clubId, String memberId})> linkGuardian({
    String? clubId,
    String? invitationId,
  }) async {
    final callable = _functions.httpsCallable('linkGuardian');
    final payload = <String, dynamic>{};
    if (clubId != null && clubId.isNotEmpty) payload['clubId'] = clubId;
    if (invitationId != null && invitationId.isNotEmpty) {
      payload['invitationId'] = invitationId;
    }
    final response = await callable.call<Map<String, dynamic>>(payload);
    final data = response.data;
    return (
      clubId: data['clubId'] as String? ?? clubId ?? '',
      memberId: data['memberId'] as String? ?? '',
    );
  }

  /// Révoque le parent V1 de la fiche (admin ou titulaire).
  Future<void> revokeGuardian({
    required String clubId,
    required String memberId,
    String? parentUid,
  }) async {
    final callable = _functions.httpsCallable('revokeGuardian');
    await callable.call<Map<String, dynamic>>({
      'clubId': clubId,
      'memberId': memberId,
      if (parentUid != null && parentUid.isNotEmpty) 'parentUid': parentUid,
    });
  }

  /// Change l’e-mail d’une invitation parent pending.
  Future<void> updateGuardianInviteEmail({
    required String clubId,
    required String memberId,
    required String email,
    String? invitationId,
  }) async {
    final callable = _functions.httpsCallable('updateGuardianInviteEmail');
    await callable.call<Map<String, dynamic>>({
      'clubId': clubId,
      'memberId': memberId,
      'email': email.trim(),
      if (invitationId != null && invitationId.isNotEmpty)
        'invitationId': invitationId,
    });
  }

  /// Prolonge l’expiration d’une invitation parent pending.
  Future<({String code, DateTime? expiresAt})> extendGuardianInvite({
    required String clubId,
    required String memberId,
    String? invitationId,
  }) async {
    final callable = _functions.httpsCallable('extendGuardianInvite');
    final response = await callable.call<Map<String, dynamic>>({
      'clubId': clubId,
      'memberId': memberId,
      if (invitationId != null && invitationId.isNotEmpty)
        'invitationId': invitationId,
    });
    final data = response.data;
    final expiresRaw = data['expiresAt'] as String?;
    return (
      code: data['code'] as String? ?? '',
      expiresAt: expiresRaw != null ? DateTime.tryParse(expiresRaw) : null,
    );
  }

  /// Régénère le code d’une invitation parent pending.
  Future<({String code, DateTime? expiresAt})> regenerateGuardianInvite({
    required String clubId,
    required String memberId,
    String? invitationId,
  }) async {
    final callable = _functions.httpsCallable('regenerateGuardianInvite');
    final response = await callable.call<Map<String, dynamic>>({
      'clubId': clubId,
      'memberId': memberId,
      if (invitationId != null && invitationId.isNotEmpty)
        'invitationId': invitationId,
    });
    final data = response.data;
    final expiresRaw = data['expiresAt'] as String?;
    return (
      code: data['code'] as String? ?? '',
      expiresAt: expiresRaw != null ? DateTime.tryParse(expiresRaw) : null,
    );
  }
}
