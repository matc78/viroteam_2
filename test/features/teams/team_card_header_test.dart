import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/teams/widgets/team_card_header.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/team_federation.dart';

void main() {
  const club = Club(
    id: 'c1',
    name: 'USM Viroflay',
    sport: 'Volley-ball',
    city: 'Viroflay',
  );

  Future<void> pump(WidgetTester tester, ClubTeam team) => tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TeamCardHeader(
              team: team,
              club: club,
              accent: Colors.indigo,
            ),
          ),
        ),
      );

  testWidgets('TeamCardHeader affiche nom, catégorie et effectif', (
    tester,
  ) async {
    await pump(
      tester,
      const ClubTeam(
        id: 't1',
        clubId: 'c1',
        name: 'Seniors M1',
        category: 'Senior',
        playerIds: ['p1', 'p2'],
        coachIds: ['c1'],
      ),
    );

    expect(find.text('Seniors M1'), findsOneWidget);
    expect(find.text('Senior · 2 joueurs · 1 coach'), findsOneWidget);
    expect(find.text(AppCopy.standings.federationBadge), findsNothing);
  });

  testWidgets('TeamCardHeader : pastille FFVB si l’équipe est liée', (
    tester,
  ) async {
    await pump(
      tester,
      const ClubTeam(
        id: 't1',
        clubId: 'c1',
        name: 'Seniors M1',
        federation: TeamFederationLink(
          provider: 'ffvb',
          teamKey: 'usm-de-viroflay',
          teamName: 'USM DE VIROFLAY',
        ),
      ),
    );

    expect(find.text(AppCopy.standings.federationBadge), findsOneWidget);
  });
}
