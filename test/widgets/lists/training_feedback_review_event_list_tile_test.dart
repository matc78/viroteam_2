import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/lists/training_feedback_review_event_list_tile.dart';

void main() {
  testWidgets('TrainingFeedbackReviewEventListTile affiche le nombre de retours',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: TrainingFeedbackReviewEventListTile(
            title: 'Entraînement',
            dateLabel: 'sam. 21/11',
            teamLabel: 'U15',
            feedbackCount: 2,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('sam. 21/11 · U15'), findsOneWidget);
    expect(find.text(AppCopy.training.reviewCount(2)), findsOneWidget);
    await tester.tap(find.text('Entraînement'));
    expect(tapped, isTrue);
  });
}
