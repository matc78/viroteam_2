import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_announcement.dart';

ClubAnnouncement _announcement({
  required DateTime createdAt,
  DateTime? endsAt,
  DateTime? closedAt,
}) {
  return ClubAnnouncement(
    id: 'a1',
    clubId: 'c1',
    senderId: 'u1',
    senderFirstName: 'Test',
    senderLastName: 'Viro',
    message: 'hello',
    createdAt: createdAt,
    endsAt: endsAt,
    closedAt: closedAt,
  );
}

void main() {
  group('ClubAnnouncement.isActive', () {
    test('sans endsAt : active dans la semaine suivant createdAt', () {
      final announcement = _announcement(
        createdAt: DateTime.now().subtract(const Duration(days: 3)),
      );
      expect(announcement.isActive, isTrue);
    });

    test('sans endsAt : inactive après createdAt + 7 jours', () {
      final announcement = _announcement(
        createdAt: DateTime.now().subtract(const Duration(days: 8)),
      );
      expect(announcement.isActive, isFalse);
    });

    test('endsAt futur : active même si createdAt ancien', () {
      final announcement = _announcement(
        createdAt: DateTime.now().subtract(const Duration(days: 60)),
        endsAt: DateTime.now().add(const Duration(days: 1)),
      );
      expect(announcement.isActive, isTrue);
    });

    test('endsAt passé : inactive', () {
      final announcement = _announcement(
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
        endsAt: DateTime.now().subtract(const Duration(hours: 1)),
      );
      expect(announcement.isActive, isFalse);
    });

    test('closedAt : inactive même avec endsAt futur', () {
      final announcement = _announcement(
        createdAt: DateTime.now(),
        endsAt: DateTime.now().add(const Duration(days: 7)),
        closedAt: DateTime.now(),
      );
      expect(announcement.isActive, isFalse);
    });
  });
}
