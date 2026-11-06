import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Garde-fou « une seule clé membre » : l'id de `members/{memberId}` est la
/// seule clé (= UID Auth une fois le compte lié). Plus d'index
/// `member_accounts`, plus d'alias uid ↔ memberId, et l'accès à une fiche
/// passe par l'unique helper `clubMemberRef`.
void main() {
  const memberRefHelper = 'lib/services/member/member_paths.dart';

  final forbidden = <String, RegExp>{
    'index member_accounts supprimé': RegExp(
      r'memberAccountsSubcollection|member_accounts',
    ),
    'alias effectiveUid supprimé': RegExp(r'\beffectiveUid\b'),
    'alias rosterIdVariants supprimé': RegExp(r'\brosterIdVariants\b'),
    'repli accountUid ?? … (clé unique = id de la fiche)':
        RegExp(r'accountUid\s*\?\?'),
  };
  final memberDocAccess = RegExp(r'membersSubcollection\)\s*\.doc\(');

  test('aucun résolveur uid ↔ memberId dans lib/', () {
    final directory = Directory('lib');
    expect(directory.existsSync(), isTrue, reason: 'lancer depuis la racine');
    final offending = <String>[];

    for (final entity in directory.listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final path = entity.path.replaceAll(r'\', '/');
      final content = entity.readAsStringSync();
      forbidden.forEach((reason, pattern) {
        if (pattern.hasMatch(content)) offending.add('$path ($reason)');
      });
      if (path != memberRefHelper && memberDocAccess.hasMatch(content)) {
        offending.add('$path (utiliser clubMemberRef de $memberRefHelper)');
      }
    }

    expect(offending, isEmpty, reason: offending.join('\n'));
  });

  test('le helper clubMemberRef existe toujours', () {
    final helper = File(memberRefHelper);
    expect(helper.existsSync(), isTrue);
    expect(helper.readAsStringSync(), contains('clubMemberRef'));
  });
}
