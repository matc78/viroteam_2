import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/services/fee/fee_paths.dart';

/// Mutations admin des saisons de cotisation.
class FeeSeasonOperations {
  /// Crée le module de gestion des saisons.
  FeeSeasonOperations({required FeePaths paths}) : _paths = paths;

  final FeePaths _paths;

  /// Crée une saison et désactive l'ancienne si la nouvelle devient active.
  Future<String> createSeason({
    required String clubId,
    required FeeSeason season,
  }) async {
    final uid = _paths.currentUid();
    if (uid == null) throw StateError('Non connecté');

    final seasonsCollection = _paths.feeSeasonsCol(clubId);
    final newSeasonRef = seasonsCollection.doc();
    final seasonData = season.toFirestoreCreate();

    if (season.isActive) {
      final existingActiveSeasons =
          await seasonsCollection
              .where(FirestoreFields.isActive, isEqualTo: true)
              .get();
      if (existingActiveSeasons.docs.isNotEmpty) {
        final batch = _paths.db.batch();
        for (final seasonDoc in existingActiveSeasons.docs) {
          batch.update(seasonDoc.reference, {FirestoreFields.isActive: false});
        }
        batch.set(newSeasonRef, seasonData);
        await batch.commit();
        return newSeasonRef.id;
      }
    }

    await newSeasonRef.set(seasonData);
    return newSeasonRef.id;
  }

  /// Met à jour une saison existante.
  Future<void> updateSeason({
    required String clubId,
    required FeeSeason season,
  }) async {
    await _paths
        .feeSeasonRef(clubId, season.id)
        .update(season.toFirestoreUpdate());
  }

  /// Ferme une saison active.
  Future<void> closeSeason({
    required String clubId,
    required String seasonId,
  }) async {
    await _paths.feeSeasonRef(clubId, seasonId).update({
      FirestoreFields.isActive: false,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
