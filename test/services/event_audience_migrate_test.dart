import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/services/event/event_audience_migrate.dart';

void main() {
  group('migrateTeamMemberIds', () {
    test('remplace legacy par canonique et déduplique', () {
      expect(
        migrateTeamMemberIds(['mem-a', 'uid-b'], 'mem-a', 'uid-a'),
        ['uid-a', 'uid-b'],
      );
      expect(
        migrateTeamMemberIds(['mem-a', 'uid-a'], 'mem-a', 'uid-a'),
        ['uid-a'],
      );
      expect(migrateTeamMemberIds(['uid-a'], 'mem-a', 'uid-a'), isNull);
    });
  });

  group('planRsvpMigration', () {
    test('déplace la valeur si canonique absente', () {
      final plan = planRsvpMigration({'mem-a': 'yes'}, 'mem-a', 'uid-a');
      expect(plan, isNotNull);
      expect(plan!.setCanonical, isTrue);
      expect(plan.legacyValue, 'yes');
    });

    test('ne remplace pas un RSVP canonique existant', () {
      final plan = planRsvpMigration(
        {'mem-a': 'yes', 'uid-a': 'no'},
        'mem-a',
        'uid-a',
      );
      expect(plan, isNotNull);
      expect(plan!.setCanonical, isFalse);
    });
  });
}
