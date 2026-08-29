import 'dart:typed_data';

import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_defaults.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/models/club.dart';

/// Fourchettes de taille de club (question produit onboarding).
abstract final class ClubMemberCountRanges {
  static const String under30 = 'under_30';
  static const String range30to100 = '30_100';
  static const String range100to300 = '100_300';
  static const String over300 = 'over_300';

  static const List<String> all = [
    under30,
    range30to100,
    range100to300,
    over300,
  ];

  /// Libellé compact pour les puces de l'étape objectifs.
  static String label(String key) => switch (key) {
        under30 => '< 30',
        range30to100 => '30 – 100',
        range100to300 => '100 – 300',
        over300 => '300+',
        _ => key,
      };

  /// Libellé explicite pour le récapitulatif de création.
  static String recapLabel(String key) => switch (key) {
        under30 => 'Moins de 30 membres',
        range30to100 => '30 à 100 membres',
        range100to300 => '100 à 300 membres',
        over300 => 'Plus de 300 membres',
        _ => label(key),
      };
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
      brandColorHex != ClubSetupDefaults.brandColorHex;

  bool get canProceedIdentity => name.trim().length >= 2 && sport.isNotEmpty;

  bool get canProceedObjectives => objectives.isNotEmpty;

  bool get canProceedInfo =>
      city.trim().isNotEmpty && practiceLocations.isNotEmpty;

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
        'wizardVersion': ClubSetupSteps.wizardVersion,
      };

  factory ClubSetupDraft.fromJson(Map<String, dynamic> json) {
    final locationsRaw = json['practiceLocations'] as List<dynamic>? ?? [];
    final objectivesRaw = json['objectives'] as List<dynamic>? ?? [];

    return ClubSetupDraft(
      name: json['name'] as String? ?? '',
      sport: json['sport'] as String? ?? ClubSports.all.first,
      logoFilePath: json['logoFilePath'] as String?,
      objectives: objectivesRaw.whereType<String>().toSet(),
      city: json['city'] as String? ?? '',
      postalCode: json['postalCode'] as String? ?? '',
      address: json['address'] as String? ?? '',
      practiceLocations: locationsRaw
          .whereType<Map<String, dynamic>>()
          .map(PracticeLocation.fromMap)
          .toList(),
      description: json['description'] as String? ?? '',
      currentStep: ClubSetupSteps.normalizePersistedStep(
        (json['currentStep'] as int?) ?? 0,
        wizardVersion: (json['wizardVersion'] as int?) ?? 1,
      ),
      memberCountRange: json['memberCountRange'] as String?,
      brandColorHex: json['brandColorHex'] as String? ??
          ClubSetupDefaults.brandColorHex,
    );
  }
}
