import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/youth_team_category.dart';

ClubTeam _team(String id, String? category) => ClubTeam(
      id: id,
      clubId: 'club',
      name: id,
      category: category,
    );

void main() {
  group('isUnder15TeamCategory', () {
    test('accepte U/M/- jusqu’à 15', () {
      expect(isUnder15TeamCategory('U7'), isTrue);
      expect(isUnder15TeamCategory('U14'), isTrue);
      expect(isUnder15TeamCategory('U15'), isTrue);
      expect(isUnder15TeamCategory('M13'), isTrue);
      expect(isUnder15TeamCategory('M15'), isTrue);
      expect(isUnder15TeamCategory('-15'), isTrue);
      expect(isUnder15TeamCategory('U12 Filles'), isTrue);
    });

    test('refuse les catégories 16 ans et plus', () {
      expect(isUnder15TeamCategory('U16'), isFalse);
      expect(isUnder15TeamCategory('M16'), isFalse);
      expect(isUnder15TeamCategory('-18'), isFalse);
      expect(isUnder15TeamCategory('Sénior'), isFalse);
      expect(isUnder15TeamCategory('Loisir'), isFalse);
      expect(isUnder15TeamCategory(null), isFalse);
      expect(isUnder15TeamCategory(''), isFalse);
    });

    test('plages tennis : 13/14 oui, 15/16 non', () {
      expect(isUnder15TeamCategory('13/14 ans'), isTrue);
      expect(isUnder15TeamCategory('11/12 ans'), isTrue);
      expect(isUnder15TeamCategory('15/16 ans'), isFalse);
      expect(isUnder15TeamCategory('17/18 ans'), isFalse);
    });

    test('libellés nominaux judo / natation / galaxies', () {
      expect(isUnder15TeamCategory('Benjamin'), isTrue);
      expect(isUnder15TeamCategory('Minime'), isTrue);
      expect(isUnder15TeamCategory('Cadet'), isFalse);
      expect(isUnder15TeamCategory('Avenirs'), isTrue);
      expect(isUnder15TeamCategory('Juniors 1'), isFalse);
      expect(isUnder15TeamCategory('Galaxie Rouge'), isTrue);
    });
  });

  group('isYouthTeamCategory (plafond chat ≤ 13)', () {
    test('U13 oui, U14/U15 non', () {
      expect(isYouthTeamCategory('U13'), isTrue);
      expect(isYouthTeamCategory('U14'), isFalse);
      expect(isYouthTeamCategory('U15'), isFalse);
      expect(isYouthTeamCategory('M13'), isTrue);
      expect(isYouthTeamCategory('13/14 ans'), isFalse);
    });
  });

  group('memberHasUnder15Team', () {
    test('false si aucune équipe', () {
      expect(memberHasUnder15Team(teams: const []), isFalse);
    });

    test('true dès qu’une équipe est moins de 15', () {
      expect(
        memberHasUnder15Team(
          teams: [_team('a', 'U18'), _team('b', 'U14')],
        ),
        isTrue,
      );
    });

    test('false si toutes les équipes sont seniors / U16+', () {
      expect(
        memberHasUnder15Team(
          teams: [_team('a', 'U18'), _team('b', 'Sénior')],
        ),
        isFalse,
      );
    });

    test('false si équipes sans catégorie', () {
      expect(
        memberHasUnder15Team(teams: [_team('a', null), _team('b', '')]),
        isFalse,
      );
    });

    test('match catalogue sport pour libellés nominaux', () {
      expect(
        memberHasUnder15Team(
          teams: [_team('a', 'Poussin')],
          sport: 'judo',
        ),
        isTrue,
      );
    });
  });

  group('under15TeamCategoriesForSport', () {
    test('football inclut U15 et exclut U16', () {
      final cats = under15TeamCategoriesForSport('football');
      expect(cats, contains('U15'));
      expect(cats, contains('U7'));
      expect(cats, isNot(contains('U16')));
      expect(cats, isNot(contains('Sénior')));
    });

    test('rugby s’arrête à M14', () {
      final cats = under15TeamCategoriesForSport('rugby');
      expect(cats, contains('M14'));
      expect(cats, isNot(contains('M16')));
    });
  });
}
