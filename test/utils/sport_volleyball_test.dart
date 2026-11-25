import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';

void main() {
  test('isVolleyballSport : volley (variantes) seulement', () {
    expect(isVolleyballSport('Volleyball'), isTrue);
    expect(isVolleyballSport('Volley-ball'), isTrue);
    expect(isVolleyballSport('Beach volley'), isTrue);
    expect(isVolleyballSport('Football'), isFalse);
    expect(isVolleyballSport(null), isFalse);
  });
}
