import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/youth_team_category.dart';

void main() {
  test('détecte U/M/- ≤ 13', () {
    expect(isYouthTeamCategory('U12'), isTrue);
    expect(isYouthTeamCategory('M13'), isTrue);
    expect(isYouthTeamCategory('-11'), isTrue);
    expect(isYouthTeamCategory('U14'), isFalse);
    expect(isYouthTeamCategory('Sénior'), isFalse);
    expect(isYouthTeamCategory('11/12 ans'), isTrue);
    expect(isYouthTeamCategory('15/16 ans'), isFalse);
    expect(isYouthTeamCategory(null), isFalse);
  });
}
