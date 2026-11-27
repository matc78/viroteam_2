import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_team_category_tones.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/widgets/lists/team_category_header_list_tile.dart';

void main() {
  testWidgets(
    'affiche catégorie, nombre d’équipes et alertes ; tap = bascule',
    (tester) async {
      var toggles = 0;
      const group = TeamCategoryGroup(
        category: 'M11',
        tone: TeamCategoryTone.blue,
        teams: [
          ClubTeam(id: 'a', clubId: 'c', name: 'M11 A', playerIds: ['p']),
          ClubTeam(id: 'b', clubId: 'c', name: 'M11 B', coachIds: ['x']),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: ViroTheme.light,
          home: Scaffold(
            body: TeamCategoryHeaderListTile(
              group: group,
              expanded: true,
              onToggle: () => toggles++,
            ),
          ),
        ),
      );

      // Un seul texte (nom, nombre d’équipes, alertes) : le nom garde la place.
      final header = find.textContaining('M11', findRichText: true);
      expect(header, findsOneWidget);
      final text = tester.widget<RichText>(header).text.toPlainText();
      expect(text, contains(AppCopy.teams.categoryTeamCount(2)));
      expect(
        text,
        contains(
          '${AppCopy.teams.categoryNoCoach(1)} · '
          '${AppCopy.teams.categoryNoPlayer(1)}',
        ),
      );

      // Lecteur d’écran : un seul libellé, alertes comprises.
      expect(
        find.bySemanticsLabel(
          AppCopy.teams.categoryHeaderSemantics(
            category: 'M11',
            count: 2,
            alerts: [
              AppCopy.teams.categoryNoCoach(1),
              AppCopy.teams.categoryNoPlayer(1),
            ],
            expanded: true,
          ),
        ),
        findsOneWidget,
      );

      await tester.tap(header);
      expect(toggles, 1);
    },
  );
}
