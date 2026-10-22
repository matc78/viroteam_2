import 'package:cloud_firestore/cloud_firestore.dart';
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

  group('buildEventAudienceMigrationPatch', () {
    test('migre aussi rsvpUpdatedAt avec le RSVP', () {
      final patch = buildEventAudienceMigrationPatch(
        teamMemberIds: ['mem-a', 'other'],
        rsvp: {'mem-a': 'maybe'},
        rsvpUpdatedAt: {'mem-a': 'ts-legacy'},
        legacyId: 'mem-a',
        canonicalId: 'uid-a',
      );
      expect(patch, isNotNull);
      expect(patch!['teamMemberIds'], ['uid-a', 'other']);
      expect(patch['rsvp.uid-a'], 'maybe');
      expect(patch['rsvpUpdatedAt.mem-a'], isA<FieldValue>());
      expect(patch['rsvpUpdatedAt.uid-a'], 'ts-legacy');
    });

    test('ne copie pas le timestamp si le RSVP canonique est conservé', () {
      final patch = buildEventAudienceMigrationPatch(
        teamMemberIds: ['uid-a'],
        rsvp: {'mem-a': 'yes', 'uid-a': 'no'},
        rsvpUpdatedAt: {'mem-a': 'ts-legacy'},
        legacyId: 'mem-a',
        canonicalId: 'uid-a',
      );
      expect(patch, isNotNull);
      expect(patch!.containsKey('rsvp.uid-a'), isFalse);
      expect(patch['rsvpUpdatedAt.mem-a'], isA<FieldValue>());
      expect(patch.containsKey('rsvpUpdatedAt.uid-a'), isFalse);
    });

    test('migre seenAt sans écraser la vue canonique', () {
      final moved = buildEventAudienceMigrationPatch(
        teamMemberIds: const [],
        rsvp: null,
        seenAt: {'mem-a': 'seen-legacy'},
        legacyId: 'mem-a',
        canonicalId: 'uid-a',
      );
      expect(moved!['seenAt.mem-a'], isA<FieldValue>());
      expect(moved['seenAt.uid-a'], 'seen-legacy');

      final kept = buildEventAudienceMigrationPatch(
        teamMemberIds: const [],
        rsvp: null,
        seenAt: {'mem-a': 'seen-legacy', 'uid-a': 'seen-canonical'},
        legacyId: 'mem-a',
        canonicalId: 'uid-a',
      );
      expect(kept!['seenAt.mem-a'], isA<FieldValue>());
      expect(kept.containsKey('seenAt.uid-a'), isFalse);
    });
  });
}
