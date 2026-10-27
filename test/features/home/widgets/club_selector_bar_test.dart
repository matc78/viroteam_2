import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/home/widgets/club_selector_bar.dart';
import 'package:viro_team_v2/models/club.dart';

UserClubEntry _entry(String id, String name) => UserClubEntry(
  club: Club(id: id, name: name, sport: 'Football'),
);

Future<void> _pumpBar(WidgetTester tester, List<UserClubEntry> clubs) {
  return tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: ClubSelectorBar(
              clubs: clubs,
              pendingByClub: const {},
              onAddClub: () {},
            ),
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('un seul club : pastille large avec nom complet', (tester) async {
    await _pumpBar(tester, [_entry('c1', 'Association Sportive Viro')]);

    expect(find.text('Association Sportive Viro'), findsOneWidget);
    expect(find.text(AppCopy.home.openClub), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('plusieurs clubs : logos compacts sans invite', (tester) async {
    await _pumpBar(tester, [_entry('c1', 'Viro FC'), _entry('c2', 'Rugby')]);

    expect(find.text(AppCopy.home.openClub), findsNothing);
    expect(find.text('Viro FC'), findsOneWidget);
    expect(find.text('Rugby'), findsOneWidget);
  });
}
