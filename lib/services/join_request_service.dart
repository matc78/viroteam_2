import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/join_request.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Demandes de changement de rôle : création (membre) et traitement (admin).
class JoinRequestService {
  JoinRequestService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? appFirestore,
        _functions =
            functions ?? FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> get _requests =>
      _db.collection(ProjectConfig.joinRequestsCollection);

  Future<void> createRoleChangeRequest({
    required ViroUser user,
    required Club club,
    required String currentRole,
    required String roleRequested,
    String message = '',
  }) async {
    if (currentRole == roleRequested) {
      throw StateError('Vous avez déjà ce rôle.');
    }

    await _requests.add({
      FirestoreFields.userId: user.uid,
      FirestoreFields.clubId: club.id,
      FirestoreFields.clubName: club.name,
      FirestoreFields.clubSport: club.sport,
      FirestoreFields.roleRequested: roleRequested,
      FirestoreFields.firstName: user.firstName,
      FirestoreFields.lastName: user.lastName,
      if (user.phone != null) FirestoreFields.phone: user.phone,
      FirestoreFields.message: message,
      FirestoreFields.status: JoinRequestStatus.pending,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Demandes en attente du club, plus anciennes d'abord (lecture admin).
  Stream<List<JoinRequest>> watchPendingClubRequests(String clubId) {
    return _requests
        .where(FirestoreFields.clubId, isEqualTo: clubId)
        .where(FirestoreFields.status, isEqualTo: JoinRequestStatus.pending)
        .snapshots()
        .map((snap) {
      final requests = snap.docs.map(JoinRequest.fromFirestore).toList();
      final epoch = DateTime.fromMillisecondsSinceEpoch(0);
      requests.sort(
        (a, b) => (a.createdAt ?? epoch).compareTo(b.createdAt ?? epoch),
      );
      return requests;
    });
  }

  /// Accepte (rôle appliqué côté serveur) ou refuse une demande via la
  /// callable `resolveJoinRequest`.
  Future<void> resolveRequest({
    required String requestId,
    required bool accept,
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('resolveJoinRequest'));
    await callable.call(<String, dynamic>{
      'requestId': requestId,
      'decision': accept ? 'accept' : 'refuse',
    });
  }
}
