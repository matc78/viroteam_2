import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';

/// Operations autour des invitations membres et des fiches non inscrites.
class MemberInvitationOperations {
  /// Cree le module invitations membres.
  MemberInvitationOperations({
    required FirebaseFirestore firestore,
    required String Function(String? rawEmail) normalizeEmail,
  }) : _db = firestore,
       _normalizeEmail = normalizeEmail;

  final FirebaseFirestore _db;
  final String Function(String? rawEmail) _normalizeEmail;

  CollectionReference<Map<String, dynamic>> _members(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.membersSubcollection);

  CollectionReference<Map<String, dynamic>> _invitations(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.invitationsSubcollection);

  /// Met a jour prenom / nom / e-mail d'un membre pas encore inscrit.
  ///
  /// L'e-mail est obligatoire (normalise) et synchronise sur l'invitation
  /// active si presente : seul ce compte pourra accepter l'invitation.
  Future<void> updatePendingMemberProfile({
    required String clubId,
    required String memberId,
    required String firstName,
    required String lastName,
    required String email,
  }) async {
    final trimmedFirst = formatFirstName(firstName);
    final trimmedLast = formatLastName(lastName);
    final normalizedEmail = _normalizeEmail(email);

    final memberRef = _members(clubId).doc(memberId);

    await _db.runTransaction((tx) async {
      final memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) {
        throw StateError(AppCopy.members.memberNotFound);
      }

      final data = memberSnap.data()!;
      final accountUid =
          (data[FirestoreFields.accountUid] as String?)?.trim() ?? '';
      final legacyUserId =
          (data[FirestoreFields.userId] as String?)?.trim() ?? '';
      if (accountUid.isNotEmpty || legacyUserId.isNotEmpty) {
        throw StateError(AppCopy.members.identityLocked);
      }

      final activeInvitationId =
          (data[FirestoreFields.activeInvitationId] as String?)?.trim() ?? '';
      DocumentReference<Map<String, dynamic>>? inviteRef;
      DocumentSnapshot<Map<String, dynamic>>? inviteSnap;
      if (activeInvitationId.isNotEmpty) {
        inviteRef = _invitations(clubId).doc(activeInvitationId);
        inviteSnap = await tx.get(inviteRef);
      }

      final existingSnapshot = data[FirestoreFields.snapshot];
      final nextSnapshot = <String, dynamic>{
        if (existingSnapshot is Map<String, dynamic>) ...existingSnapshot,
        FirestoreFields.displayName: '$trimmedFirst $trimmedLast',
        FirestoreFields.email: normalizedEmail,
      };

      tx.update(memberRef, {
        FirestoreFields.firstName: trimmedFirst,
        FirestoreFields.lastName: trimmedLast,
        FirestoreFields.snapshot: nextSnapshot,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      if (inviteRef != null && inviteSnap?.exists == true) {
        tx.update(inviteRef, {
          FirestoreFields.firstName: trimmedFirst,
          FirestoreFields.lastName: trimmedLast,
          FirestoreFields.email: normalizedEmail,
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  }

  /// Garantit une invitation `pending` valide pour un membre non inscrit.
  ///
  /// Reutilise le code existant s'il est encore valable, sinon en cree un
  /// nouveau (et expire l'ancien pending). Synchronise aussi `snapshot.email`.
  Future<void> ensureMemberInvitation({
    required String clubId,
    required Club club,
    required ClubMember member,
    required String sentByUid,
    required String email,
  }) async {
    final normalizedEmail = _normalizeEmail(email);
    final memberRef = _members(clubId).doc(member.memberId);
    final newInviteRef = _invitations(clubId).doc();
    final code = generateInviteCode();
    final expiresAt = DateTime.now().add(const Duration(days: 7));

    await _db.runTransaction((tx) async {
      final memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) {
        throw StateError(AppCopy.members.memberNotFound);
      }
      final data = memberSnap.data()!;
      final accountUid =
          (data[FirestoreFields.accountUid] as String?)?.trim() ?? '';
      if (accountUid.isNotEmpty) {
        throw StateError(AppCopy.members.memberAlreadyLinked);
      }

      final existingSnapshot = data[FirestoreFields.snapshot];
      final nextSnapshot = <String, dynamic>{
        if (existingSnapshot is Map<String, dynamic>) ...existingSnapshot,
        FirestoreFields.email: normalizedEmail,
      };

      final previousInviteId =
          (data[FirestoreFields.activeInvitationId] as String?)?.trim() ?? '';
      if (previousInviteId.isNotEmpty) {
        final previousInviteRef = _invitations(clubId).doc(previousInviteId);
        final previousInviteSnap = await tx.get(previousInviteRef);
        if (previousInviteSnap.exists) {
          final previous = ClubInvitation.fromDocument(previousInviteSnap);
          if (previous.isPending &&
              previous.code.trim().isNotEmpty &&
              !previous.isExpired) {
            tx.update(previousInviteRef, {
              FirestoreFields.email: normalizedEmail,
              FirestoreFields.expiresAt: Timestamp.fromDate(expiresAt),
              FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
            });
            tx.update(memberRef, {
              FirestoreFields.snapshot: nextSnapshot,
              FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
            });
            return;
          }
          if (previous.status == InvitationStatus.pending) {
            tx.update(previousInviteRef, {
              FirestoreFields.status: InvitationStatus.expired,
              FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      final role = data[FirestoreFields.role] as String? ?? MemberRoles.player;
      final firstName =
          (data[FirestoreFields.firstName] as String?)?.trim() ??
          member.firstName?.trim() ??
          '';
      final lastName =
          (data[FirestoreFields.lastName] as String?)?.trim() ??
          member.lastName?.trim() ??
          '';

      tx.set(newInviteRef, {
        FirestoreFields.code: code,
        FirestoreFields.type: InvitationTypes.member,
        FirestoreFields.role: role,
        FirestoreFields.status: InvitationStatus.pending,
        FirestoreFields.email: normalizedEmail,
        FirestoreFields.memberId: member.memberId,
        FirestoreFields.sentBy: sentByUid,
        FirestoreFields.sentAt: FieldValue.serverTimestamp(),
        FirestoreFields.expiresAt: Timestamp.fromDate(expiresAt),
        FirestoreFields.clubName: club.name,
        FirestoreFields.clubSport: club.sport,
        FirestoreFields.firstName: firstName,
        FirestoreFields.lastName: lastName,
      });
      tx.update(memberRef, {
        FirestoreFields.activeInvitationId: newInviteRef.id,
        FirestoreFields.snapshot: nextSnapshot,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  /// Prepare les invitations de plusieurs membres non inscrits (parallele).
  Future<void> ensureMemberInvitations({
    required String clubId,
    required Club club,
    required List<ClubMember> members,
    required String sentByUid,
  }) async {
    const chunkSize = 10;
    for (var start = 0; start < members.length; start += chunkSize) {
      final end = (start + chunkSize > members.length)
          ? members.length
          : start + chunkSize;
      final chunk = members.sublist(start, end);
      await Future.wait(
        chunk.map(
          (member) => ensureMemberInvitation(
            clubId: clubId,
            club: club,
            member: member,
            sentByUid: sentByUid,
            email: member.email ?? '',
          ),
        ),
      );
    }
  }

  /// Construit le message de partage d'une invitation membre.
  String inviteMessageFor({
    required Club club,
    required ClubInvitation invitation,
  }) => buildInviteMessage(club: club, invitation: invitation);
}
