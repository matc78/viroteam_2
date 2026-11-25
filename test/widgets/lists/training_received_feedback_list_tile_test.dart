import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/lists/training_received_feedback_list_tile.dart';

void main() {
  Widget host(Widget child) => MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(body: child),
      );

  testWidgets('retour non lu : bloc date, enfant et pastille Nouveau',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      host(
        TrainingReceivedFeedbackListTile(
          weekdayLabel: 'sam.',
          dayLabel: '21',
          monthLabel: 'nov.',
          title: 'Entraînement',
          subtitle: 'senior A · Coach Alexandre Petit',
          isNew: true,
          childFirstName: 'Inès',
          onTap: () => tapped = true,
        ),
      ),
    );

    expect(find.text('21'), findsOneWidget);
    expect(find.text('SAM.'), findsOneWidget);
    expect(find.text('senior A · Coach Alexandre Petit'), findsOneWidget);
    expect(find.text(AppCopy.training.receivedForChild('Inès')), findsOneWidget);
    expect(find.text(AppCopy.training.receivedNew), findsOneWidget);
    await tester.tap(find.text('Entraînement'));
    expect(tapped, isTrue);
  });

  testWidgets('retour lu : pas de pastille Nouveau', (tester) async {
    await tester.pumpWidget(
      host(
        const TrainingReceivedFeedbackListTile(
          weekdayLabel: 'lun.',
          dayLabel: '9',
          monthLabel: 'nov.',
          title: 'Entraînement',
          subtitle: 'sénior 1 · Ton coach',
          isNew: false,
        ),
      ),
    );

    expect(find.text(AppCopy.training.receivedNew), findsNothing);
  });
}
