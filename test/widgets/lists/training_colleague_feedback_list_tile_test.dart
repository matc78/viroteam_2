import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/lists/training_colleague_feedback_list_tile.dart';

void main() {
  testWidgets('TrainingColleagueFeedbackListTile affiche le collègue et réagit au tap',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: TrainingColleagueFeedbackListTile(
            coachName: 'Alexandre Petit',
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(
      find.text(AppCopy.training.colleagueFeedbackTitle('Alexandre Petit')),
      findsOneWidget,
    );
    expect(find.text(AppCopy.training.colleagueFeedbackSubtitle), findsOneWidget);
    await tester.tap(find.text(AppCopy.training.colleagueFeedbackSubtitle));
    expect(tapped, isTrue);
  });
}
