import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/widgets/lists/attendance_event_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/attendance_member_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/attendance_team_list_tile.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/lists/member_team_attendance_list_tile.dart';

const _team = ClubTeam(
  id: 't1',
  clubId: 'c',
  name: 'M15',
  playerIds: ['a', 'b'],
);

ClubEvent _event(String id, int day, Map<String, String> rsvp) => ClubEvent(
  id: id,
  clubId: 'c',
  type: EventTypes.training,
  title: 'Entraînement',
  date: DateTime(2026, 11, day),
  startTime: '18:00',
  teamIds: const ['t1'],
  teamMemberIds: const ['a', 'b'],
  rsvp: rsvp,
);

// « b » ne répond jamais : à relancer après 3 convocations.
final _row = computeTeamAttendance(
  team: _team,
  events: [
    _event('1', 10, {'a': 'yes'}),
    _event('2', 12, {'a': 'yes'}),
    _event('3', 14, {'a': 'no'}),
  ],
  names: const {'a': 'Alice', 'b': 'Bruno'},
  now: DateTime(2026, 11, 26),
);

Widget _wrap(Widget child) => MaterialApp(
  theme: ViroTheme.light,
  home: Scaffold(body: child),
);

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  testWidgets('AttendanceTeamListTile : taux, détail et à relancer', (
    tester,
  ) async {
    var tapped = false;
    await tester.pumpWidget(
      _wrap(AttendanceTeamListTile(row: _row, onTap: () => tapped = true)),
    );
    expect(find.text('M15'), findsOneWidget);
    expect(find.text(AppCopy.attendance.rate(33)), findsOneWidget);
    expect(find.text(AppCopy.attendance.toRemindBadge(1)), findsOneWidget);
    await tester.tap(find.text('M15'));
    expect(tapped, isTrue);
  });

  testWidgets('AttendanceMemberListTile : « Répond peu » et sans convocation', (
    tester,
  ) async {
    final bruno = _row.players.firstWhere((p) => p.memberId == 'b');
    await tester.pumpWidget(_wrap(AttendanceMemberListTile(member: bruno)));
    expect(find.text('Bruno'), findsOneWidget);
    expect(find.text(AppCopy.attendance.lowResponder), findsOneWidget);

    await tester.pumpWidget(
      _wrap(
        const AttendanceMemberListTile(
          member: MemberAttendance(
            memberId: 'z',
            name: 'Zoé',
            counts: RsvpCounts.empty,
          ),
        ),
      ),
    );
    expect(find.text(AppCopy.attendance.noConvocation), findsOneWidget);
  });

  testWidgets('AttendanceEventListTile : titre et oui sur convoqués', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(AttendanceEventListTile(row: _row.events.first, title: 'Séance')),
    );
    expect(find.text('Séance'), findsOneWidget);
    expect(find.textContaining('0/2 joueurs'), findsOneWidget);
  });

  testWidgets('MemberTeamAttendanceListTile : équipe, badge, taux et convocs', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        MemberTeamAttendanceListTile(
          row: _row,
          roles: const [ViroRole.player],
        ),
      ),
    );
    expect(find.text('M15'), findsOneWidget);
    expect(find.text(AppCopy.common.rolePlayer), findsNothing);
    expect(find.byType(ViroRoleBadge), findsOneWidget);
    expect(find.text(AppCopy.attendance.memberYes(33)), findsOneWidget);
    expect(
      find.textContaining(AppCopy.attendance.memberYesOf(2, 6)),
      findsOneWidget,
    );
    expect(
      find.textContaining(
        AppCopy.attendance.memberTrainingMatch(
          trainingYes: _row.training.yes,
          trainingConvoked: _row.training.convoked,
          matchYes: _row.match.yes,
          matchConvoked: _row.match.convoked,
        ),
      ),
      findsOneWidget,
    );
  });
}
