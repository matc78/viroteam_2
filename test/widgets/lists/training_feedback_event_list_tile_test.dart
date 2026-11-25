import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/widgets/lists/training_feedback_event_list_tile.dart';

void main() {
  testWidgets('TrainingFeedbackEventListTile affiche séance, équipe et statut',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: TrainingFeedbackEventListTile(
            title: 'Entraînement',
            dateLabel: 'Mardi 25 novembre',
            teamLabel: 'Seniors F',
            status: TrainingFeedbackStatus.todo,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('Entraînement'), findsOneWidget);
    expect(find.text('Mardi 25 novembre · Seniors F'), findsOneWidget);
    expect(find.text(AppCopy.training.statusTodo), findsOneWidget);
    await tester.tap(find.text('Entraînement'));
    expect(tapped, isTrue);
  });

  testWidgets('TrainingFeedbackEventListTile signale un retour envoyé',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: TrainingFeedbackEventListTile(
            title: 'Entraînement',
            dateLabel: 'Mardi 25 novembre',
            status: TrainingFeedbackStatus.sent,
          ),
        ),
      ),
    );

    expect(find.text(AppCopy.training.statusSent), findsOneWidget);
    expect(find.text('Mardi 25 novembre'), findsOneWidget);
  });

  testWidgets('TrainingFeedbackEventListTile : badge Flemme et appui long',
      (tester) async {
    var longPressed = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: TrainingFeedbackEventListTile(
            title: 'Entraînement',
            dateLabel: 'Mardi 25 novembre',
            status: TrainingFeedbackStatus.skipped,
            onTap: () {},
            onLongPress: () => longPressed = true,
          ),
        ),
      ),
    );

    expect(find.text(AppCopy.training.statusSkipped), findsOneWidget);
    await tester.longPress(find.text('Entraînement'));
    expect(longPressed, isTrue);
  });
}
