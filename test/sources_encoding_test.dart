import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Garde-fou encodage : aucun fichier `lib/**/*.dart` ne doit contenir le
/// caractère de remplacement U+FFFD (octets EF BF BD), signe d'un texte FR
/// corrompu (« pay� » au lieu de « payé »).
void main() {
  test('aucun caractère U+FFFD dans les sources lib/', () {
    final libDirectory = Directory('lib');
    expect(libDirectory.existsSync(), isTrue, reason: 'lancer depuis la racine');

    final offendingFiles = <String>[];
    for (final entity in libDirectory.listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final source = utf8.decode(entity.readAsBytesSync(), allowMalformed: true);
      if (source.contains('�')) {
        offendingFiles.add(entity.path);
      }
    }

    expect(
      offendingFiles,
      isEmpty,
      reason: 'Fichiers contenant U+FFFD : ${offendingFiles.join(', ')}',
    );
  });
}
