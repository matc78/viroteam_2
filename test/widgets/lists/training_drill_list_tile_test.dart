import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';
import 'package:viro_team_v2/widgets/common/whiteboard/viro_whiteboard.dart';
import 'package:viro_team_v2/widgets/lists/training_drill_list_tile.dart';

void main() {
  testWidgets('TrainingDrillListTile affiche rang, titre, durée et schéma',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: TrainingDrillListTile(
            drill: const TrainingDrill(
              id: 'd1',
              title: 'Service-réception',
              durationMin: 15,
              instructions: '3 contre 3, rotation toutes les 5 balles',
              boards: [
                WhiteboardData(
                  tokens: [
                    WhiteboardToken(
                      kind: WhiteboardTokenKind.player,
                      position: WhiteboardPoint(0.5, 0.5),
                      label: '1',
                    ),
                  ],
                ),
                WhiteboardData(court: WhiteboardCourt.blank),
              ],
            ),
            position: 1,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('1'), findsOneWidget);
    expect(find.text('Service-réception'), findsOneWidget);
    expect(find.text(AppCopy.training.drillDuration(15)), findsOneWidget);
    expect(find.byType(WhiteboardThumbnail), findsOneWidget);
    expect(find.text(AppCopy.training.drillBoardCount(2)), findsOneWidget);
    await tester.tap(find.text('Service-réception'));
    expect(tapped, isTrue);
  });

  testWidgets('un exercice sans titre ni schéma garde un libellé', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: TrainingDrillListTile(
            drill: TrainingDrill(id: 'd2'),
            position: 1,
          ),
        ),
      ),
    );

    expect(find.text(AppCopy.training.untitledDrill(1)), findsOneWidget);
    expect(find.byType(WhiteboardThumbnail), findsNothing);
  });
}
