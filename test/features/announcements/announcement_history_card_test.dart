import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/announcements/utils/announcement_filter.dart';
import 'package:viro_team_v2/features/announcements/widgets/announcement_history_card.dart';
import 'package:viro_team_v2/models/club_announcement.dart';

ClubAnnouncement _announcement({
  required String id,
  DateTime? closedAt,
  DateTime? createdAt,
}) {
  return ClubAnnouncement(
    id: id,
    clubId: 'c1',
    senderId: 'u1',
    senderFirstName: 'Alex',
    senderLastName: 'Coach',
    message: 'Entraînement décalé à 19h',
    createdAt: createdAt ?? DateTime.now(),
    closedAt: closedAt,
  );
}

Future<void> _pumpCard(WidgetTester tester, ClubAnnouncement announcement) {
  return tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(
        body: AnnouncementHistoryCard(
          announcement: announcement,
          targetLabel: 'Tout le club',
          accentColor: Colors.blue,
          canManage: true,
          onTap: () {},
          onEdit: () {},
          onDelete: () {},
          onClose: announcement.isActive ? () {} : null,
        ),
      ),
    ),
  );
}

void main() {
  test('splitByStatus sépare actives et clôturées/expirées', () {
    final active = _announcement(id: 'a');
    final closed = _announcement(id: 'b', closedAt: DateTime.now());
    final expired = _announcement(
      id: 'c',
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
    );

    final sections = AnnouncementFilter.splitByStatus([
      closed,
      active,
      expired,
    ]);

    expect(sections.active.map((a) => a.id), ['a']);
    expect(sections.closed.map((a) => a.id), ['b', 'c']);
  });

  testWidgets('annonce active : message, pas de badge de statut', (
    tester,
  ) async {
    await _pumpCard(tester, _announcement(id: 'a'));

    expect(find.text('Entraînement décalé à 19h'), findsOneWidget);
    expect(find.text(AppCopy.announcements.closedBadge), findsNothing);
  });

  testWidgets('annonce clôturée : badge visible, menu sans « Clôturer »', (
    tester,
  ) async {
    await _pumpCard(tester, _announcement(id: 'b', closedAt: DateTime.now()));

    expect(find.text(AppCopy.announcements.closedBadge), findsOneWidget);

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();

    expect(find.text(AppCopy.common.delete), findsOneWidget);
    expect(find.text(AppCopy.announcements.closeAction), findsNothing);
  });
}
