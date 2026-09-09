import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';

/// Couleurs d'accent pour les étapes du wizard (alignées onboarding / home).
abstract final class ClubSetupUi {
  static const List<Color> sportAccents = [
    ViroColors.sportGreen,
    ViroColors.sportOrange,
    ViroColors.sportCyan,
    ViroColors.sportYellow,
  ];

  static const List<Color> prerequisiteAccents = [
    ViroColors.sportGreen,
    ViroColors.sportCyan,
    ViroColors.sportOrange,
    ViroColors.sportYellow,
    ViroColors.adminBadgeEnd,
  ];

  /// Accent unique de l'étape [step] (barre de progression + contenu).
  static Color stepAccent(int step) {
    return switch (ClubSetupSteps.clampIndex(step)) {
      ClubSetupSteps.prerequisites => ViroColors.sportGreen,
      ClubSetupSteps.identity => ViroColors.primary600,
      ClubSetupSteps.objectives => ViroColors.sportCyan,
      ClubSetupSteps.memberCount => ViroColors.sportYellow,
      ClubSetupSteps.headquarters => ViroColors.sportCyan,
      ClubSetupSteps.practiceLocations => ViroColors.sportOrange,
      ClubSetupSteps.recap => ViroColors.sportYellow,
      _ => ViroColors.sportOrange,
    };
  }

  static Color sportAccent(String sport) {
    final index = ClubSports.all.indexOf(sport);
    if (index < 0) return ViroColors.primary600;
    return sportAccents[index % sportAccents.length];
  }

  static Color objectiveAccent(String key) => switch (key) {
        ClubObjectives.planning => ViroColors.sportCyan,
        ClubObjectives.attendance => ViroColors.sportGreen,
        ClubObjectives.fees => ViroColors.sportOrange,
        ClubObjectives.equipment => ViroColors.sportYellow,
        ClubObjectives.communication => ViroColors.primary400,
        ClubObjectives.members => ViroColors.sportGreen,
        ClubObjectives.teams => ViroColors.sportCyan,
        ClubObjectives.documents => ViroColors.gray600,
        ClubObjectives.parents => ViroColors.parentBadgeEnd,
        ClubObjectives.stats => ViroColors.sportOrange,
        _ => ViroColors.primary600,
      };
}
