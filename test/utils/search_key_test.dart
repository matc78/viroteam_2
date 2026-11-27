import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/search_key.dart';

void main() {
  test('searchKey retire accents, casse et espaces autour', () {
    expect(searchKey('  Réception Équipe '), 'reception equipe');
    expect(searchKey('Façon Noël'), 'facon noel');
    expect(searchKey('Cœur'), 'coeur');
    expect(searchKey(''), '');
  });
}
