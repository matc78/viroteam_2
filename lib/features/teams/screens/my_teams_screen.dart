import 'package:flutter/material.dart';
import 'package:viro_team_v2/features/teams/screens/teams_hub_screen.dart';

/// Conservé pour compat imports — délègue au hub Équipes (onglet Mes équipes).
class MyTeamsScreen extends StatelessWidget {
  const MyTeamsScreen({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context) {
    return TeamsHubScreen(
      clubId: clubId,
      initialTab: TeamsHubTab.mine,
    );
  }
}
