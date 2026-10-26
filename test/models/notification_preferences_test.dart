import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/notification_preferences.dart';

void main() {
  group('NotificationPreferences', () {
    test('défauts alignés avec les Functions : récap oui, coéquipiers non', () {
      final prefs = NotificationPreferences.fromMap(const {});
      expect(prefs.weeklyDigest, isTrue);
      expect(prefs.rsvpTeammates, isFalse);
      expect(prefs.events, isTrue);
      expect(prefs.coachSummaryTiming, CoachSummaryTiming.eve);
    });

    test('bilan coach : valeur inconnue → veille', () {
      final prefs = NotificationPreferences.fromMap(const {
        'coachSummaryTiming': 'j-1',
      });
      expect(prefs.coachSummaryTiming, CoachSummaryTiming.eve);
    });

    test('aller-retour Firestore', () {
      const prefs = NotificationPreferences(
        weeklyDigest: false,
        rsvpTeammates: true,
        coachSummaryTiming: CoachSummaryTiming.day,
      );
      final back = NotificationPreferences.fromMap(prefs.toMap());
      expect(back.weeklyDigest, isFalse);
      expect(back.rsvpTeammates, isTrue);
      expect(back.coachSummaryTiming, CoachSummaryTiming.day);
    });
  });

  test('rappel J-7 coché d’office pour tournoi et réunion seulement', () {
    expect(addEventImportantByDefault(EventTypes.tournament), isTrue);
    expect(addEventImportantByDefault(EventTypes.meeting), isTrue);
    expect(addEventImportantByDefault(EventTypes.training), isFalse);
    expect(addEventImportantByDefault(EventTypes.match), isFalse);
  });
}
