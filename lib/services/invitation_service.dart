import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/email_validation.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

class InvitationLookupResult {
  const InvitationLookupResult({
    required this.invitation,
    required this.club,
  });

  final ClubInvitation invitation;
  final Club club;
}

/// Erreur métier lisible lors de l'acceptation d'une invitation.
class InvitationAcceptException implements Exception {
  const InvitationAcceptException(this.message);

  final String message;

  @override
  String toString() => message;
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

  /// Message affiché quand la callable refuse l'acceptation (`permission-denied`).
  static const String reservedForOtherEmailMessage =
      'Cette invitation est réservée à un autre e-mail. '
      'Demande à l\'administrateur du club de renvoyer un code à ton adresse.';

  /// Recherche une invitation par code via la callable `lookupInvitationByCode`
  /// (la lecture directe en collection group n'est plus autorisée).
  ///
  /// Retourne `null` si le code est vide, introuvable ou expiré.
  Future<InvitationLookupResult?> findByCode(String rawCode) async {
    final code = rawCode.trim().toUpperCase();
    if (code.isEmpty) return null;

    final callable =
        _functions.httpsCallable(cloudCallableName('lookupInvitationByCode'));
    final response = await callable.call<dynamic>(<String, dynamic>{
      'code': code,
    });
    return parseLookupResponse(response.data);
  }

  /// Transforme la réponse brute de `lookupInvitationByCode` en
  /// [InvitationLookupResult] (invitation + club minimal pour l'affichage).
  ///
  /// `{ found: false }` (ou réponse inattendue) ⇒ `null`.
  static InvitationLookupResult? parseLookupResponse(Object? rawResponse) {
    if (rawResponse is! Map) return null;
    final response = Map<String, dynamic>.from(rawResponse);
    if (response['found'] != true) return null;

    final rawInvitation = response['invitation'];
    if (rawInvitation is! Map) return null;
    final invitation =
        ClubInvitation.fromLookup(Map<String, dynamic>.from(rawInvitation));
    if (invitation.id.isEmpty || invitation.clubId.isEmpty) return null;
    if (!invitation.isPending) return null;

    final club = Club(
      id: invitation.clubId,
      name: invitation.clubName ?? '',
      sport: invitation.clubSport ?? '',
    );
    return InvitationLookupResult(invitation: invitation, club: club);
  }

  /// Accepte une invitation membre via Cloud Function (transaction serveur).
  ///
  /// Le contrôle « invitation réservée à l'e-mail invité » est fait côté
  /// serveur ; un refus `permission-denied` est traduit en message clair.
  Future<void> acceptInvitation({
    required ClubInvitation invitation,
    required ViroUser user,
  }) async {
    if (invitation.isGuardian) {
      throw StateError(
        'Utiliser GuardianService.linkGuardian pour une invitation parent.',
      );
    }

    final callable =
        _functions.httpsCallable(cloudCallableName('acceptInvitation'));
    try {
      await callable.call(<String, dynamic>{
        'clubId': invitation.clubId,
        'invitationId': invitation.id,
      });
    } on FirebaseFunctionsException catch (error) {
      if (error.code == 'permission-denied') {
        throw const InvitationAcceptException(reservedForOtherEmailMessage);
      }
      throw InvitationAcceptException(
        callableErrorMessage(
          error,
          fallback: 'Impossible d\'accepter l\'invitation.',
        ),
      );
    }
  }

  /// Invitations en attente adressées à [authEmail] (collection group).
  ///
  /// [authEmail] doit être l'e-mail du compte Firebase Auth : la règle
  /// Firestore compare `invitations.email` à `request.auth.token.email`.
  Future<List<ClubInvitation>> getPendingInvitationsForEmail(
    String authEmail,
  ) async {
    final normalized = normalizeEmail(authEmail);
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

  /// Refuse une invitation (`pending → declined`, champs `status`/`updatedAt`).
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
