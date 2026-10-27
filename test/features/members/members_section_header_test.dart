import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/members_section_header.dart';

void main() {
  testWidgets(
      'sections en segmented control et raccourci Équipes distinct',
      (tester) async {
    final changes = <MembersScreenSection>[];
    var teamsOpened = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: MembersSectionHeader(
            section: MembersScreenSection.roster,
            onSectionChanged: changes.add,
            onOpenTeams: () => teamsOpened++,
          ),
        ),
      ),
    );

    expect(find.byType(SegmentedButton<MembersScreenSection>), findsOneWidget);
    // « Équipes » n’est plus un segment : c’est une ligne de navigation.
    expect(
      find.descendant(
        of: find.byType(SegmentedButton<MembersScreenSection>),
        matching: find.text(AppCopy.teams.manageTitle),
      ),
      findsNothing,
    );

    await tester.tap(find.text(AppCopy.members.tabParents));
    await tester.pumpAndSettle();
    expect(changes, [MembersScreenSection.parents]);

    await tester.tap(find.text(AppCopy.teams.manageTitle));
    await tester.pumpAndSettle();
    expect(teamsOpened, 1);
  });
}
