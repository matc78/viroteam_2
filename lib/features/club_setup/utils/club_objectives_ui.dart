import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Icônes UI pour les objectifs club (assistant création).
IconData clubObjectiveIcon(String key) => switch (key) {
      ClubObjectives.planning => ViroIcons.calendar,
      ClubObjectives.attendance => ViroIcons.check,
      ClubObjectives.fees => ViroIcons.payments,
      ClubObjectives.equipment => ViroIcons.ball,
      ClubObjectives.communication => ViroIcons.bell,
      ClubObjectives.members => ViroIcons.users,
      ClubObjectives.teams => ViroIcons.groups,
      ClubObjectives.documents => ViroIcons.note,
      ClubObjectives.parents => ViroIcons.roleParent,
      ClubObjectives.stats => ViroIcons.trophy,
      _ => ViroIcons.check,
    };
