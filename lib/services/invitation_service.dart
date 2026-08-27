import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

class InvitationLookupResult {
  const InvitationLookupResult({
    required this.invitation,
    required this.club,
  });

  final ClubInvitation invitation;
  final Club club;
}

class InvitationService {
  InvitationService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? appFirestore,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  Future<InvitationLookupResult?> findByCode(String rawCode) async {
    final code = rawCode.trim().toUpperCase();
    if (code.isEmpty) return null;

    final snap = await _db
        .collectionGroup(ProjectConfig.invitationsSubcollection)
        .where(FirestoreFields.code, isEqualTo: code)
        .where(FirestoreFields.status, isEqualTo: InvitationStatus.pending)
        .limit(1)
        .get();

    if (snap.docs.isEmpty) return null;

    final inviteDoc = snap.docs.first;
    var invitation = ClubInvitation.fromQuery(inviteDoc);
    if (!invitation.isPending) return null;

    Club club;
    if (invitation.clubName != null && invitation.clubName!.isNotEmpty) {
      club = Club(
        id: invitation.clubId,
        name: invitation.clubName!,
        sport: invitation.clubSport ?? '',
        memberCount: 0,
        adminIds: const [],
      );
    } else {
      final clubDoc = await _db
          .collection(ProjectConfig.clubsCollection)
          .doc(invitation.clubId)
          .get();
      if (!clubDoc.exists) return null;
      club = Club.fromFirestore(clubDoc);
      invitation = invitation.copyWith(
        clubName: club.name,
        clubSport: club.sport,
      );
    }

    invitation = await _withInviteeProfile(invitation);

    return InvitationLookupResult(invitation: invitation, club: club);
  }

  /// Prénom / nom depuis l'invitation ou le membre pré-créé (rejoindre par code).
  Future<ClubInvitation> _withInviteeProfile(ClubInvitation invitation) async {
    var firstName = invitation.firstName?.trim();
    var lastName = invitation.lastName?.trim();
    var email = invitation.email?.trim();

    final needsMemberLookup = (firstName == null || firstName.isEmpty) ||
        (lastName == null || lastName.isEmpty);
    final memberId = invitation.memberId;
    if (needsMemberLookup && memberId != null && memberId.isNotEmpty) {
      final memberSnap = await _db
          .collection(ProjectConfig.clubsCollection)
          .doc(invitation.clubId)
          .collection(ProjectConfig.membersSubcollection)
          .doc(memberId)
          .get();
      if (memberSnap.exists) {
        final member = ClubMember.fromFirestore(memberSnap);
        firstName ??= member.firstName?.trim();
        lastName ??= member.lastName?.trim();
        email ??= member.email?.trim();
      }
    }

    if (firstName == invitation.firstName &&
        lastName == invitation.lastName &&
        email == invitation.email) {
      return invitation;
    }

    return invitation.copyWith(
      email: email ?? invitation.email,
      firstName: firstName,
      lastName: lastName,
    );
  }

  /// Accepte une invitation membre via Cloud Function (transaction serveur).
  Future<void> acceptInvitation({
    required ClubInvitation invitation,
    required ViroUser user,
  }) async {
    if (invitation.isGuardian) {
      throw StateError(
        'Utiliser GuardianService.linkGuardian pour une invitation parent.',
      );
    }
    if (invitation.email != null &&
        invitation.email!.trim().toLowerCase() !=
            user.emailNorm.trim().toLowerCase()) {
      throw StateError('Cette invitation est réservée à un autre email.');
    }

    final callable =
        _functions.httpsCallable(cloudCallableName('acceptInvitation'));
    await callable.call(<String, dynamic>{
      'clubId': invitation.clubId,
      'invitationId': invitation.id,
    });
  }

  /// Invitations en attente adressées à l'email de l'utilisateur (collection group).
  Future<List<ClubInvitation>> getPendingInvitationsForEmail(
    String email,
  ) async {
    final normalized = email.trim().toLowerCase();
    if (normalized.isEmpty) return [];

    final snap = await _db
        .collectionGroup(ProjectConfig.invitationsSubcollection)
        .where(FirestoreFields.email, isEqualTo: normalized)
        .where(FirestoreFields.status, isEqualTo: InvitationStatus.pending)
        .get();

    final invites = <ClubInvitation>[];
    for (final doc in snap.docs) {
      var invitation = ClubInvitation.fromQuery(doc);
      if (!invitation.isPending) continue;

      final clubDoc = await _db
          .collection(ProjectConfig.clubsCollection)
          .doc(invitation.clubId)
          .get();
      if (!clubDoc.exists) continue;

      final club = Club.fromFirestore(clubDoc);
      invites.add(
        invitation.copyWith(
          clubName: club.name,
          clubSport: club.sport,
        ),
      );
    }

    invites.sort((a, b) {
      final at = a.sentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bt = b.sentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bt.compareTo(at);
    });
    return invites;
  }

  Future<void> declineInvitation(ClubInvitation invitation) async {
    await _db
        .collection(ProjectConfig.clubsCollection)
        .doc(invitation.clubId)
        .collection(ProjectConfig.invitationsSubcollection)
        .doc(invitation.id)
        .update({
      FirestoreFields.status: InvitationStatus.declined,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
