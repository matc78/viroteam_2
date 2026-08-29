import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Item d’inventaire club (`clubs/{clubId}/equipment/{itemId}`).
class ClubEquipmentItem {
  const ClubEquipmentItem({
    required this.id,
    required this.name,
    required this.category,
    required this.quantity,
    required this.condition,
    this.location = '',
    this.assignedTeamId,
    this.notes = '',
    this.updatedAt,
    this.updatedBy,
  });

  final String id;
  final String name;
  final String category;
  final int quantity;
  final String condition;
  final String location;
  final String? assignedTeamId;
  final String notes;
  final DateTime? updatedAt;
  final String? updatedBy;

  factory ClubEquipmentItem.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? {};
    final rawCondition = data[FirestoreFields.condition] as String? ?? '';
    return ClubEquipmentItem(
      id: doc.id,
      name: (data[FirestoreFields.name] as String? ?? '').trim(),
      category: (data[FirestoreFields.category] as String? ?? '').trim(),
      quantity: (data[FirestoreFields.quantity] as num?)?.toInt() ?? 0,
      condition: _parseCondition(rawCondition),
      location: (data[FirestoreFields.location] as String? ?? '').trim(),
      assignedTeamId: _nullableString(data[FirestoreFields.assignedTeamId]),
      notes: (data[FirestoreFields.notes] as String? ?? '').trim(),
      updatedAt: (data[FirestoreFields.updatedAt] as Timestamp?)?.toDate(),
      updatedBy: _nullableString(data[FirestoreFields.updatedBy]),
    );
  }

  static String _parseCondition(String raw) {
    if (raw == EquipmentConditions.use || raw == EquipmentConditions.hs) {
      return raw;
    }
    return EquipmentConditions.ok;
  }

  static String? _nullableString(Object? value) {
    final trimmed = (value as String? ?? '').trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

/// Libellé FR d’un état inventaire (aligné portail).
String equipmentConditionLabel(String condition) {
  if (condition == EquipmentConditions.use) return 'Usé';
  if (condition == EquipmentConditions.hs) return 'HS';
  return 'OK';
}

/// Données formulaire création / édition inventaire.
class ClubEquipmentInput {
  const ClubEquipmentInput({
    required this.name,
    required this.category,
    required this.quantity,
    required this.condition,
    this.location = '',
    this.assignedTeamId,
    this.notes = '',
  });

  final String name;
  final String category;
  final int quantity;
  final String condition;
  final String location;
  final String? assignedTeamId;
  final String notes;
}
