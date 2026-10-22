import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
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

  /// Accent unique de l'étape [step] (barre de progression + contenu) ;
  /// [palette] fournit l'accent de marque du thème courant.
  static Color stepAccent(int step, ViroPalette palette) {
    return switch (ClubSetupSteps.clampIndex(step)) {
      ClubSetupSteps.prerequisites => ViroColors.sportGreen,
      ClubSetupSteps.identity => palette.accent,
      ClubSetupSteps.objectives => ViroColors.sportCyan,
      ClubSetupSteps.memberCount => ViroColors.sportYellow,
      ClubSetupSteps.headquarters => ViroColors.sportCyan,
      ClubSetupSteps.practiceLocations => ViroColors.sportOrange,
      ClubSetupSteps.recap => ViroColors.sportYellow,
      _ => ViroColors.sportOrange,
    };
  }

  /// Accent associé au sport [sport] ; accent de marque de [palette] si
  /// le sport est inconnu.
  static Color sportAccent(String sport, ViroPalette palette) {
    final index = ClubSports.all.indexOf(sport);
    if (index < 0) return palette.accent;
    return sportAccents[index % sportAccents.length];
  }

  /// Accent de l'objectif [key] ; les teintes neutres / de marque suivent
  /// [palette].
  static Color objectiveAccent(String key, ViroPalette palette) =>
      switch (key) {
        ClubObjectives.planning => ViroColors.sportCyan,
        ClubObjectives.attendance => ViroColors.sportGreen,
        ClubObjectives.fees => ViroColors.sportOrange,
        ClubObjectives.equipment => ViroColors.sportYellow,
        ClubObjectives.communication => palette.accentMid,
        ClubObjectives.members => ViroColors.sportGreen,
        ClubObjectives.teams => ViroColors.sportCyan,
        ClubObjectives.documents => palette.textSecondary,
        ClubObjectives.parents => ViroColors.parentBadgeEnd,
        ClubObjectives.stats => ViroColors.sportOrange,
        _ => palette.accent,
      };
}
