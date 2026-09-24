import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/models/parent_link.dart';

void main() {
  const clubId = 'club1';

  ParentLink childLink(String memberId) => ParentLink(
        clubId: clubId,
        memberId: memberId,
        relation: 'parent',
        status: 'active',
      );

  FamilyAudienceTarget childTarget(String memberId, {String label = 'Enfant'}) =>
      FamilyAudienceTarget(
        memberId: memberId,
        label: label,
        kind: FamilyAudienceKind.child,
      );

  const selfTarget = FamilyAudienceTarget(
    memberId: 'self',
    label: 'Moi',
    kind: FamilyAudienceKind.self,
  );

  group('resolveFamilyPrimaryChildMemberId', () {
    test('null si aucun lien enfant', () {
      expect(
        resolveFamilyPrimaryChildMemberId(
          childLinks: const [],
          selectedAudience: childTarget('child2'),
        ),
        isNull,
      );
    });

    test('fallback 1er enfant si pas de sélection', () {
      final links = [childLink('child1'), childLink('child2')];
      expect(
        resolveFamilyPrimaryChildMemberId(
          childLinks: links,
          selectedAudience: null,
        ),
        'child1',
      );
    });

    test('fallback 1er enfant si sélection = Moi', () {
      final links = [childLink('child1'), childLink('child2')];
      expect(
        resolveFamilyPrimaryChildMemberId(
          childLinks: links,
          selectedAudience: selfTarget,
        ),
        'child1',
      );
    });

    test('suit l’enfant sélectionné (2e lien)', () {
      final links = [childLink('child1'), childLink('child2')];
      expect(
        resolveFamilyPrimaryChildMemberId(
          childLinks: links,
          selectedAudience: childTarget('child2', label: 'Léa'),
        ),
        'child2',
      );
    });

    test('fallback 1er enfant si sélection hors liens actifs', () {
      final links = [childLink('child1'), childLink('child2')];
      expect(
        resolveFamilyPrimaryChildMemberId(
          childLinks: links,
          selectedAudience: childTarget('ghost'),
        ),
        'child1',
      );
    });
  });

  group('shouldShowAudienceSwitcher', () {
    test('false : une seule cible', () {
      expect(shouldShowAudienceSwitcher([childTarget('child1')]), isFalse);
    });

    test('false : parent seul avec un enfant (pas de Moi)', () {
      expect(
        shouldShowAudienceSwitcher([childTarget('child1')]),
        isFalse,
      );
    });

    test('true : parent avec deux enfants', () {
      expect(
        shouldShowAudienceSwitcher([
          childTarget('child1'),
          childTarget('child2'),
        ]),
        isTrue,
      );
    });

    test('true : Moi + un enfant', () {
      expect(
        shouldShowAudienceSwitcher([selfTarget, childTarget('child1')]),
        isTrue,
      );
    });
  });
}
