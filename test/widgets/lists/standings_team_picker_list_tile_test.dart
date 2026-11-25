import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/widgets/lists/standings_team_picker_list_tile.dart';

void main() {
  testWidgets('StandingsTeamPickerListTile affiche équipe et poule', (
    tester,
  ) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: StandingsTeamPickerListTile(
            team: const ClubTeam(
              id: 't1',
              clubId: 'c1',
              name: 'Seniors M',
              federation: TeamFederationLink(
                provider: 'ffvb',
                teamKey: 'usm-de-viroflay',
                teamName: 'USM DE VIROFLAY',
                poolLabel: '1MB - ACCESSION REGIONALE MASC',
              ),
            ),
            accentColor: Colors.teal,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('Seniors M'), findsOneWidget);
    expect(find.text('1MB - ACCESSION REGIONALE MASC'), findsOneWidget);
    await tester.tap(find.text('Seniors M'));
    expect(tapped, isTrue);
  });
}
