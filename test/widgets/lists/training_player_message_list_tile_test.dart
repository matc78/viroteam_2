import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/lists/training_player_message_list_tile.dart';

const _member = ClubMember(
  memberId: 'm1',
  status: 'active',
  firstName: 'Léa',
  lastName: 'Martin',
);

void main() {
  testWidgets('l’icône message déplie le champ et remonte la saisie',
      (tester) async {
    String? typed;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: TrainingPlayerMessageListTile(
            member: _member,
            message: '',
            onChanged: (text) => typed = text,
          ),
        ),
      ),
    );

    expect(find.text('Léa Martin'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    await tester.tap(find.byTooltip(AppCopy.training.playerMessageHint));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Super service');
    expect(typed, 'Super service');
  });

  testWidgets('en lecture seule, affiche le message sans champ', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: TrainingPlayerMessageListTile(
            member: _member,
            message: 'Bravo pour ta réception',
            readOnly: true,
          ),
        ),
      ),
    );

    expect(find.text('Bravo pour ta réception'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(find.byTooltip(AppCopy.training.playerMessageHint), findsNothing);
  });
}
