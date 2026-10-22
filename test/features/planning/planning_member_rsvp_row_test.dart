import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_member_rsvp_row.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/seen_eye.dart';

const _member = ClubMember(
  memberId: 'm1',
  role: MemberRoles.player,
  status: 'active',
  firstName: 'Léa',
  lastName: 'Martin',
  hasLinkedAccount: true,
);

Future<void> _pumpRow(
  WidgetTester tester, {
  required RsvpStatus status,
  DateTime? lastUpdatedAt,
  DateTime? seenAt,
}) =>
    tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: PlanningMemberRsvpRow(
            member: _member,
            status: status,
            lastUpdatedAt: lastUpdatedAt,
            seenAt: seenAt,
          ),
        ),
      ),
    );

Finder _eye({required bool seen}) => find.byWidgetPredicate(
      (widget) => widget is SeenEye && widget.seen == seen,
    );

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  final when = DateTime(2026, 10, 12, 13, 45);

  testWidgets('affiche l’œil « vu » quand le membre n’a pas répondu',
      (tester) async {
    await _pumpRow(tester, status: RsvpStatus.none, seenAt: when);
    await tester.pumpAndSettle();

    expect(_eye(seen: true), findsOneWidget);
    expect(find.text(AppCopy.common.seen), findsOneWidget);
    expect(
      find.bySemanticsLabel(AppCopy.planning.seenNotAnswered('12/10 à 13h45')),
      findsOneWidget,
    );
  });

  testWidgets('affiche l’œil fermé tant que le membre n’a rien vu',
      (tester) async {
    await _pumpRow(tester, status: RsvpStatus.none);

    expect(_eye(seen: false), findsOneWidget);
    expect(find.text(AppCopy.common.seen), findsNothing);
    expect(find.bySemanticsLabel(AppCopy.common.notSeenYet), findsOneWidget);
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('masque l’œil dès que le membre a répondu', (tester) async {
    await _pumpRow(
      tester,
      status: RsvpStatus.yes,
      lastUpdatedAt: when,
      seenAt: when,
    );

    expect(find.byType(SeenEye), findsNothing);
    expect(find.text('13h45'), findsOneWidget);
    expect(find.text('12/10'), findsOneWidget);
    expect(
      find.bySemanticsLabel(AppCopy.planning.rsvpAnsweredAt('12/10 à 13h45')),
      findsOneWidget,
    );
  });
}
