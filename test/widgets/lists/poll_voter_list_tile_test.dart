import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/widgets/lists/poll_voter_list_tile.dart';

Future<void> _pump(WidgetTester tester, PollVoterListTile tile) {
  return tester.pumpWidget(
    MaterialApp(theme: ViroTheme.light, home: Scaffold(body: tile)),
  );
}

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  final now = DateTime(2026, 11, 5, 18);

  testWidgets('PollVoterListTile : nom et heure du vote du jour',
      (tester) async {
    await _pump(
      tester,
      PollVoterListTile(
        displayName: 'Sam',
        voteTime: ChatPollVoteTime(at: DateTime(2026, 11, 5, 14, 43)),
        now: now,
      ),
    );

    expect(find.text('Sam'), findsOneWidget);
    expect(find.text('Voté à 14:43'), findsOneWidget);
  });

  testWidgets('PollVoterListTile : vote modifié un autre jour', (tester) async {
    await _pump(
      tester,
      PollVoterListTile(
        displayName: 'Sam',
        voteTime: ChatPollVoteTime(
          at: DateTime(2026, 11, 4, 9, 12),
          edited: true,
        ),
        now: now,
      ),
    );

    expect(find.text('Modifié le 4/11 à 09:12'), findsOneWidget);
  });

  testWidgets('PollVoterListTile : ancien vote sans heure', (tester) async {
    await _pump(tester, const PollVoterListTile(displayName: 'Sam'));

    expect(find.text('Sam'), findsOneWidget);
    expect(find.textContaining('Voté'), findsNothing);
  });
}
