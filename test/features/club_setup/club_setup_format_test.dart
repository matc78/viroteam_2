import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/models/club.dart';

void main() {
  group('ClubSetupFormat.withoutLinkedHeadquarters', () {
    test('écarte les lieux liés au siège', () {
      const linked = PracticeLocation(
        name: 'Siège auto',
        linkedToHeadquarters: true,
      );
      const manual = PracticeLocation(
        name: 'Gaillon',
        address: '1 rue A',
      );

      expect(
        ClubSetupFormat.withoutLinkedHeadquarters([linked, manual]),
        [manual],
      );
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

  group('ClubSetupFormat.practiceLocationsSummary', () {
    test('résume par catégorie et ville', () {
      expect(
        ClubSetupFormat.practiceLocationsSummary(
          locations: const [
            PracticeLocation(
              name: 'a',
              category: 'city_stade',
              city: 'Lyon',
            ),
            PracticeLocation(
              name: 'b',
              category: 'city_stade',
              city: 'Lyon',
            ),
          ],
        ),
        '2 city-stades à Lyon',
      );
    });
  });
}
