import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/parent_link.dart';

void main() {
  group('ParentLink', () {
    test('parse la forme cible clubId + memberId', () {
      final link = ParentLink.fromMap({
        FirestoreFields.clubId: 'club-1',
        FirestoreFields.memberId: 'member-marie',
        FirestoreFields.relation: GuardianRelations.parent,
        FirestoreFields.status: GuardianStatuses.active,
      });
      expect(link.clubId, 'club-1');
      expect(link.memberId, 'member-marie');
      expect(link.isActive, isTrue);
    });

    test('ignore le legacy childUid comme identité du lien', () {
      final link = ParentLink.fromMap({
        FirestoreFields.clubId: 'club-1',
        FirestoreFields.childUid: 'auth-enfant',
        FirestoreFields.status: GuardianStatuses.active,
      });
      expect(link.memberId, isEmpty);
      expect(link.clubId, 'club-1');
    });

    test('pending n\'est pas actif', () {
      final link = ParentLink.fromMap({
        FirestoreFields.clubId: 'club-1',
        FirestoreFields.memberId: 'member-1',
        FirestoreFields.status: GuardianStatuses.pending,
      });
      expect(link.isActive, isFalse);
    });
  });
}
