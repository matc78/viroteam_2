import 'dart:typed_data';

import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_defaults.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';

/// Tailles d'effectif proposées à l'onboarding (10→100 puis +25).
abstract final class ClubMemberCountRanges {
  /// Anciennes fourchettes (brouillons / analytics historiques).
  static const String under30 = 'under_30';
  static const String range30to100 = '30_100';
  static const String range100to300 = '100_300';
  static const String over300 = 'over_300';

  static final List<String> all = _buildValues();

  static List<String> _buildValues() {
    final values = <String>[];
    for (var count = 10; count <= 100; count += 10) {
      values.add('$count');
    }
    for (var count = 125; count <= 1000; count += 25) {
      values.add('$count');
    }
    return values;
  }

  static bool _isNumeric(String key) {
    if (key.isEmpty) return false;
    for (var i = 0; i < key.length; i++) {
      final code = key.codeUnitAt(i);
      if (code < 48 || code > 57) return false;
    }
    return true;
  }

  /// Libellé compact pour le sélecteur.
  static String label(String key) {
    if (_isNumeric(key)) return key;
    return switch (key) {
      under30 => '< 30',
      range30to100 => '30 – 100',
      range100to300 => '100 – 300',
      over300 => '300+',
      _ => key,
    };
  }

  /// Libellé explicite pour le récapitulatif de création.
  static String recapLabel(String key) {
    if (_isNumeric(key)) return '$key membres';
    return switch (key) {
      under30 => 'Moins de 30 membres',
      range30to100 => '30 à 100 membres',
      range100to300 => '100 à 300 membres',
      over300 => 'Plus de 300 membres',
      _ => label(key),
    };
  }

  /// Mappe une ancienne fourchette vers une valeur numérique.
  static String? migratePersisted(String? value) {
    if (value == null || value.isEmpty) return null;
    if (_isNumeric(value)) return value;
    return switch (value) {
      under30 => '20',
      range30to100 => '50',
      range100to300 => '200',
      over300 => '300',
      _ => value,
    };
  }
}

/// Brouillon local de l'assistant création de club.
class ClubSetupDraft {
  ClubSetupDraft({
    this.name = '',
    String? sport,
    this.logoBytes,
    this.logoFilePath,
    Set<String>? objectives,
    this.city = '',
    this.postalCode = '',
    this.address = '',
    List<PracticeLocation>? practiceLocations,
    this.description = '',
    this.currentStep = 0,
    this.memberCountRange,
    this.brandColorHex = ClubSetupDefaults.brandColorHex,
    this.useClubAddressAsFirstLocation = true,
  })  : sport = sport ?? ClubSports.all.first,
        objectives = objectives ?? <String>{},
        practiceLocations = practiceLocations ?? [];

  String name;
  String sport;
  Uint8List? logoBytes;
  String? logoFilePath;
  Set<String> objectives;
  String city;
  String postalCode;
  String address;
  List<PracticeLocation> practiceLocations;
  String description;
  int currentStep;
  String? memberCountRange;
  String brandColorHex;
  bool useClubAddressAsFirstLocation;

  /// Indique si le brouillon contient des données saisies (hors étape courante).
  bool get hasSavedProgress =>
      name.trim().isNotEmpty ||
      city.trim().isNotEmpty ||
      address.trim().isNotEmpty ||
      description.trim().isNotEmpty ||
      objectives.isNotEmpty ||
      practiceLocations.isNotEmpty ||
      memberCountRange != null ||
      logoFilePath != null ||
      currentStep > 0 ||
      brandColorHex != ClubSetupDefaults.brandColorHex ||
      !useClubAddressAsFirstLocation;

  bool get canProceedIdentity => name.trim().length >= 2 && sport.isNotEmpty;

  bool get canProceedObjectives => objectives.isNotEmpty;

  bool get canProceedHeadquarters {
    if (cityError(city, required: true) != null) return false;
    if (postalCodeError(postalCode) != null) return false;
    if (addressLineError(address) != null) return false;
    return true;
  }

  bool get canProceedPracticeLocations => practiceLocations.isNotEmpty;

  bool get canProceedInfo =>
      canProceedHeadquarters && canProceedPracticeLocations;

  ClubSetupDraft copy() {
    return ClubSetupDraft(
      name: name,
      sport: sport,
      logoBytes: logoBytes,
      logoFilePath: logoFilePath,
      objectives: Set<String>.from(objectives),
      city: city,
      postalCode: postalCode,
      address: address,
      practiceLocations: List<PracticeLocation>.from(practiceLocations),
      description: description,
      currentStep: currentStep,
      memberCountRange: memberCountRange,
      brandColorHex: brandColorHex,
      useClubAddressAsFirstLocation: useClubAddressAsFirstLocation,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'sport': sport,
        'logoFilePath': logoFilePath,
        'objectives': objectives.toList(),
        'city': city,
        'postalCode': postalCode,
        'address': address,
        'practiceLocations':
            practiceLocations.map((location) => location.toMap()).toList(),
        'description': description,
        'currentStep': currentStep,
        'memberCountRange': memberCountRange,
        'brandColorHex': brandColorHex,
        'useClubAddressAsFirstLocation': useClubAddressAsFirstLocation,
        'wizardVersion': ClubSetupSteps.wizardVersion,
      };

  factory ClubSetupDraft.fromJson(Map<String, dynamic> json) {
    final locationsRaw = json['practiceLocations'] as List<dynamic>? ?? [];
    final objectivesRaw = json['objectives'] as List<dynamic>? ?? [];
    final sport = json['sport'] as String? ?? ClubSports.all.first;
    final city = json['city'] as String? ?? '';
    final postalCode = json['postalCode'] as String? ?? '';
    final address = json['address'] as String? ?? '';

    final locations = ClubSetupFormat.migrateLinkedHeadquarters(
      address: address,
      postalCode: postalCode,
      city: city,
      sport: sport,
      locations: locationsRaw
          .whereType<Map<String, dynamic>>()
          .map(PracticeLocation.fromMap)
          .toList(),
    );

    final useClubAddress = json['useClubAddressAsFirstLocation'] as bool? ??
        ClubSetupFormat.linkedHeadquartersIndex(locations) >= 0;

    return ClubSetupDraft(
      name: json['name'] as String? ?? '',
      sport: sport,
      logoFilePath: json['logoFilePath'] as String?,
      objectives: objectivesRaw.whereType<String>().toSet(),
      city: city,
      postalCode: postalCode,
      address: address,
      practiceLocations: locations,
      description: json['description'] as String? ?? '',
      currentStep: ClubSetupSteps.normalizePersistedStep(
        (json['currentStep'] as num?)?.toInt() ?? 0,
        wizardVersion: (json['wizardVersion'] as num?)?.toInt() ?? 1,
      ),
      memberCountRange: ClubMemberCountRanges.migratePersisted(
        json['memberCountRange'] as String?,
      ),
      brandColorHex: json['brandColorHex'] as String? ??
          ClubSetupDefaults.brandColorHex,
      useClubAddressAsFirstLocation: useClubAddress,
    );
  }
}
