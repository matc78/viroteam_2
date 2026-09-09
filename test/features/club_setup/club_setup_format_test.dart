import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/models/club.dart';

void main() {
  group('ClubSetupFormat.isSameLocation', () {
    test('ignore casse et espaces autour du nom et de l\'adresse', () {
      const first = PracticeLocation(
        name: 'Gymnase — Viroflay',
        city: 'Viroflay',
        address: '1 rue des Sports, 78220 Viroflay',
      );
      const second = PracticeLocation(
        name: ' gymnase — viroflay ',
        city: 'Viroflay',
        address: ' 1 rue des Sports ',
      );

      expect(ClubSetupFormat.isSameLocation(first, second), isTrue);
    });

    test('distingue deux adresses différentes', () {
      const first = PracticeLocation(
        name: 'Gymnase — Viroflay',
        address: '1 rue des Sports, 78220 Viroflay',
      );
      const second = PracticeLocation(
        name: 'Gymnase — Viroflay',
        address: '12 avenue de Paris, 78000 Versailles',
      );

      expect(ClubSetupFormat.isSameLocation(first, second), isFalse);
    });
  });

  group('ClubSetupFormat.headquartersPracticeLocation', () {
    test('nomme le lieu selon le sport et conserve la rue seule', () {
      final location = ClubSetupFormat.headquartersPracticeLocation(
        sport: 'Tennis',
        address: '3 allée des Courts',
        postalCode: '78220',
        city: 'Viroflay',
      );

      expect(location.name, 'Court de tennis — Viroflay');
      expect(location.address, '3 allée des Courts');
      expect(location.city, 'Viroflay');
      expect(location.category, 'tennis_court');
      expect(location.linkedToHeadquarters, isTrue);
    });
  });

  group('ClubSetupFormat.headquartersLocationIndex', () {
    test('retrouve le siège même s\'il n\'est pas en tête de liste', () {
      final headquarters = ClubSetupFormat.headquartersPracticeLocation(
        sport: 'Volleyball',
        address: '1 rue des Sports',
        postalCode: '78220',
        city: 'Viroflay',
      );
      const other = PracticeLocation(
        name: 'Gymnase municipal',
        address: 'Place du Marché, 78220 Viroflay',
      );

      final index = ClubSetupFormat.headquartersLocationIndex(
        address: '1 rue des Sports',
        postalCode: '78220',
        city: 'Viroflay',
        sport: 'Volleyball',
        locations: [other, headquarters],
      );

      expect(index, 1);
    });

    test('retrouve un siège legacy avec adresse « rue, CP Ville »', () {
      final expectedName = ClubSetupFormat.headquartersPracticeName(
        sport: 'Volleyball',
        city: 'Viroflay',
      );
      final legacyHeadquarters = PracticeLocation(
        name: expectedName,
        city: 'Viroflay',
        address: '1 rue des Sports, 78220 Viroflay',
      );

      final index = ClubSetupFormat.headquartersLocationIndex(
        address: '1 rue des Sports',
        postalCode: '78220',
        city: 'Viroflay',
        sport: 'Volleyball',
        locations: [legacyHeadquarters],
      );

      expect(index, 0);
      expect(
        ClubSetupFormat.migrateLinkedHeadquarters(
          address: '1 rue des Sports',
          postalCode: '78220',
          city: 'Viroflay',
          sport: 'Volleyball',
          locations: [legacyHeadquarters],
        ).single.linkedToHeadquarters,
        isTrue,
      );
    });

    test('ne fusionne pas un lieu au nom proche mais à l\'adresse différente',
        () {
      const similarName = PracticeLocation(
        name: 'Gymnase — Viroflay',
        address: '12 avenue de Paris, 78000 Versailles',
      );

      final index = ClubSetupFormat.headquartersLocationIndex(
        address: '1 rue des Sports',
        postalCode: '78220',
        city: 'Viroflay',
        sport: 'Volleyball',
        locations: [similarName],
      );

      expect(index, -1);
    });
  });

  group('ClubSetupFormat.streetAddressForDisplay', () {
    test('retire le suffixe legacy CP + ville', () {
      expect(
        ClubSetupFormat.streetAddressForDisplay(
          address: '1 rue des Sports, 78220 Viroflay',
          city: 'Viroflay',
        ),
        '1 rue des Sports',
      );
    });
  });
}
