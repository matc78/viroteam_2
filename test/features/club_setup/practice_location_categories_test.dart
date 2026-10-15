import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/club_setup/practice_location_categories.dart';

void main() {
  group('PracticeLocationCategories.defaultForSport', () {
    test('propose Gymnase pour Basketball, Handball et Volleyball', () {
      for (final sport in ['Basketball', 'Handball', 'Volleyball']) {
        expect(
          PracticeLocationCategories.defaultForSport(sport),
          PracticeLocationCategories.gymnasium,
          reason: sport,
        );
        expect(
          PracticeLocationCategories.forSport(sport).first,
          PracticeLocationCategories.gymnasium,
          reason: sport,
        );
      }
    });

    test('propose Stade pour Football et Rugby', () {
      for (final sport in ['Football', 'Rugby']) {
        expect(
          PracticeLocationCategories.defaultForSport(sport),
          PracticeLocationCategories.stadium,
          reason: sport,
        );
      }
    });
  });
}
