import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_equipment.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// CRUD inventaire équipements club (aligné portail `equipmentService`).
class EquipmentService {
  EquipmentService({FirebaseFirestore? firestore})
      : _db = firestore ?? appFirestore;

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _equipment(String clubId) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.equipmentSubcollection);

  /// Liste les items triés par nom.
  Future<List<ClubEquipmentItem>> listItems(String clubId) async {
    final snap = await _equipment(clubId).get();
    final items = snap.docs.map(ClubEquipmentItem.fromFirestore).toList();
    items.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    return items;
  }

  /// Crée un item d’inventaire.
  Future<String> createItem({
    required String clubId,
    required String updatedByUid,
    required ClubEquipmentInput input,
  }) async {
    _validateInput(input);
    final ref = await _equipment(clubId).add({
      FirestoreFields.name: input.name.trim(),
      FirestoreFields.category: input.category.trim(),
      FirestoreFields.quantity: input.quantity,
      FirestoreFields.condition: input.condition,
      FirestoreFields.location: input.location.trim(),
      FirestoreFields.assignedTeamId: _teamIdOrNull(input.assignedTeamId),
      FirestoreFields.notes: input.notes.trim(),
      FirestoreFields.updatedBy: updatedByUid,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  /// Met à jour un item d’inventaire.
  Future<void> updateItem({
    required String clubId,
    required String itemId,
    required String updatedByUid,
    required ClubEquipmentInput input,
  }) async {
    _validateInput(input);
    await _equipment(clubId).doc(itemId).update({
      FirestoreFields.name: input.name.trim(),
      FirestoreFields.category: input.category.trim(),
      FirestoreFields.quantity: input.quantity,
      FirestoreFields.condition: input.condition,
      FirestoreFields.location: input.location.trim(),
      FirestoreFields.assignedTeamId: _teamIdOrNull(input.assignedTeamId),
      FirestoreFields.notes: input.notes.trim(),
      FirestoreFields.updatedBy: updatedByUid,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Supprime un item d’inventaire.
  Future<void> deleteItem({
    required String clubId,
    required String itemId,
  }) async {
    await _equipment(clubId).doc(itemId).delete();
  }

  void _validateInput(ClubEquipmentInput input) {
    if (input.name.trim().isEmpty) {
      throw ArgumentError('Le nom est requis.');
    }
    if (input.category.trim().isEmpty) {
      throw ArgumentError('La catégorie est requise.');
    }
  }

  Object? _teamIdOrNull(String? teamId) {
    final trimmed = teamId?.trim() ?? '';
    return trimmed.isEmpty ? null : trimmed;
  }
}
