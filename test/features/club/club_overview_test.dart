import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/club/providers/club_overview_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_shortcuts_grid.dart';
import 'package:viro_team_v2/models/club_event.dart';

ClubEvent _event(String id, DateTime date, {bool canceled = false}) =>
    ClubEvent(
      id: id,
      clubId: 'club',
      type: EventTypes.training,
      title: 'Entraînement',
      date: date,
      canceled: canceled,
    );

void main() {
  group('countEventsThisWeek', () {
    final now = DateTime(2026, 10, 27, 18);

    test('compte les 7 prochains jours, aujourd’hui inclus', () {
      final events = [
        _event('a', DateTime(2026, 10, 27)),
        _event('b', DateTime(2026, 11, 2)),
        _event('c', DateTime(2026, 11, 3)),
      ];
      expect(countEventsThisWeek(events, now), 2);
    });

    test('ignore les événements annulés', () {
      final events = [
        _event('a', DateTime(2026, 10, 28), canceled: true),
        _event('b', DateTime(2026, 10, 29)),
      ];
      expect(countEventsThisWeek(events, now), 1);
    });
  });

  group('buildMemberShortcuts', () {
    List<ClubShortcut> build(ClubShortcutsSummary summary, {bool fee = true}) =>
        buildMemberShortcuts(
          summary: summary,
          onPlanning: () {},
          onTeams: () {},
          onAnnouncements: () {},
          onMyFee: fee ? () {} : null,
          latestAnnouncementTitle: 'Tournoi samedi',
        );

    test('affiche les infos utiles de chaque raccourci', () {
      final shortcuts = build(
        const ClubShortcutsSummary(
          weekEventCount: 3,
          teamNames: ['U13', 'Seniors', 'Loisirs'],
          fee: ClubFeeSummary(kind: ClubFeeSummaryKind.upToDate),
        ),
      );

      expect(shortcuts.map((s) => s.info), [
        '3 événements cette semaine',
        'U13, Seniors +1',
        'À jour',
        'Tournoi samedi',
      ]);
      expect(shortcuts[2].tone, ClubShortcutTone.success);
    });

    test('masque la cotisation sans saison active', () {
      final shortcuts = build(const ClubShortcutsSummary(), fee: false);
      expect(shortcuts, hasLength(3));
      expect(shortcuts.first.info, '…');
    });
  });

  testWidgets('ClubShortcutTile affiche libellé et info', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: SizedBox(
            width: 180,
            height: 84,
            child: ClubShortcutTile(
              accentColor: Colors.teal,
              shortcut: ClubShortcut(
                label: 'Planning',
                icon: Icons.calendar_today,
                info: '1 événement cette semaine',
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Planning'), findsOneWidget);
    expect(find.text('1 événement cette semaine'), findsOneWidget);
    await tester.tap(find.text('Planning'));
    expect(tapped, isTrue);
  });
}
