import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';

class PracticeLocation {
  const PracticeLocation({required this.name, this.address});

  final String name;
  final String? address;

  factory PracticeLocation.fromMap(Map<String, dynamic> map) {
    return PracticeLocation(
      name: map[FirestoreFields.name] as String? ?? '',
      address: map[FirestoreFields.address] as String?,
    );
  }

  Map<String, dynamic> toMap() => {
        FirestoreFields.name: name,
        if (address != null && address!.isNotEmpty)
          FirestoreFields.address: address,
      };
}

class Club {
  const Club({
    required this.id,
    required this.name,
    required this.sport,
    this.city,
    this.postalCode,
    this.address,
    this.description,
    this.logoUrl,
    this.brandColorHex,
    this.objectives = const [],
    this.practiceLocations = const [],
    this.adminIds = const [],
    this.memberCount = 0,
    this.helloAssoOrganizationSlug,
    this.onlinePaymentEnabled = false,
    this.seasonEndDate,
    this.createdAt,
    this.coachPermissions = CoachPermissions.defaults,
  });

  final String id;
  final String name;
  final String sport;
  final String? city;
  final String? postalCode;
  final String? address;
  final String? description;
  final String? logoUrl;
  final String? brandColorHex;
  final List<String> objectives;
  final List<PracticeLocation> practiceLocations;
  final List<String> adminIds;
  final int memberCount;
  final String? helloAssoOrganizationSlug;
  /// Paiement en ligne HelloAsso proposé aux membres (défaut : désactivé).
  final bool onlinePaymentEnabled;
  /// Fin de saison sportive (récurrence planning).
  final DateTime? seasonEndDate;
  final DateTime? createdAt;
  /// Droits coach du club (édition portail).
  final CoachPermissions coachPermissions;

  factory Club.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final locationsRaw =
        data[FirestoreFields.practiceLocations] as List<dynamic>? ?? [];
    final objectivesRaw =
        data[FirestoreFields.objectives] as List<dynamic>? ?? [];
    final permissionsRaw =
        data[FirestoreFields.coachPermissions] as Map<String, dynamic>?;

    return Club(
      id: doc.id,
      name: data[FirestoreFields.name] as String? ?? '',
      sport: data[FirestoreFields.sport] as String? ?? '',
      city: data[FirestoreFields.city] as String?,
      postalCode: data[FirestoreFields.postalCode] as String?,
      address: data[FirestoreFields.address] as String?,
      description: data[FirestoreFields.description] as String?,
      logoUrl: data[FirestoreFields.logoUrl] as String?,
      brandColorHex: data[FirestoreFields.brandColorHex] as String?,
      objectives: objectivesRaw.whereType<String>().toList(),
      practiceLocations: locationsRaw
          .whereType<Map<String, dynamic>>()
          .map(PracticeLocation.fromMap)
          .toList(),
      adminIds: (data[FirestoreFields.adminIds] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      memberCount: (data[FirestoreFields.memberCount] as num?)?.toInt() ?? 0,
      helloAssoOrganizationSlug:
          data[FirestoreFields.helloAssoOrganizationSlug] as String?,
      onlinePaymentEnabled:
          data[FirestoreFields.onlinePaymentEnabled] as bool? ?? false,
      seasonEndDate:
          (data[FirestoreFields.seasonEndDate] as Timestamp?)?.toDate(),
      createdAt: (data[FirestoreFields.createdAt] as Timestamp?)?.toDate(),
      coachPermissions: CoachPermissions.fromMap(permissionsRaw),
    );
  }
}
