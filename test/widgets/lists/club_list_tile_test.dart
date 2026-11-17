import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/lists/club_list_tile.dart';

void main() {
  testWidgets('ClubListTile affiche le nom du club', (tester) async {
    const club = Club(
      id: 'c1',
      name: 'ASM Football',
      sport: 'Football',
      city: 'Paris',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClubListTile(
            club: club,
            role: ViroRole.player,
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('ASM Football'), findsOneWidget);
    expect(find.text('Joueur'), findsOneWidget);
  });
}
