import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Chemins Firestore cotisations + helpers ledger partagés.
class FeePaths {
  /// Crée les chemins Firestore de la feature cotisations.
  FeePaths(this.db);

  final FirebaseFirestore db;

  /// Collection des saisons de cotisation d'un club.
  CollectionReference<Map<String, dynamic>> feeSeasonsCol(String clubId) =>
      db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.feeSeasonsSubcollection);

  /// Document d'une saison de cotisation.
  DocumentReference<Map<String, dynamic>> feeSeasonRef(
    String clubId,
    String seasonId,
  ) =>
      feeSeasonsCol(clubId).doc(seasonId);

  /// Collection des fiches cotisation d'une saison.
  CollectionReference<Map<String, dynamic>> memberFeesCol(
    String clubId,
    String seasonId,
  ) =>
      feeSeasonsCol(clubId)
          .doc(seasonId)
          .collection(ProjectConfig.memberFeesSubcollection);

  /// Ledger des transactions d'une fiche cotisation.
  CollectionReference<Map<String, dynamic>> paymentEventsCol(
    String clubId,
    String seasonId,
    String memberId,
  ) =>
      memberFeesCol(clubId, seasonId)
          .doc(memberId)
          .collection(ProjectConfig.paymentEventsSubcollection);

  /// UID connecté utilisé pour les actions admin terrain.
  String? currentUid() => FirebaseAuth.instance.currentUser?.uid;

  /// Ajoute une entrée immuable au ledger (même batch que la fiche).
  void appendPaymentEvent({
    required WriteBatch batch,
    required String clubId,
    required String seasonId,
    required String memberId,
    required Map<String, dynamic> payload,
  }) {
    final eventRef = paymentEventsCol(clubId, seasonId, memberId).doc();
    batch.set(eventRef, {
      ...payload,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
    });
  }

  /// Ajoute une entrée immuable au ledger (même transaction que la fiche).
  void appendPaymentEventInTransaction({
    required Transaction tx,
    required String clubId,
    required String seasonId,
    required String memberId,
    required Map<String, dynamic> payload,
  }) {
    final eventRef = paymentEventsCol(clubId, seasonId, memberId).doc();
    tx.set(eventRef, {
      ...payload,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
    });
  }
}
