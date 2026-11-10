import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Garde-fou retour haptique : tout passe par `ViroHaptics`
/// (`lib/config/viro_haptics.dart`), jamais par `HapticFeedback` en direct.
void main() {
  test('HapticFeedback n’est appelé que depuis ViroHaptics', () {
    final forbidden = RegExp(r'\bHapticFeedback\.');
    const allowed = 'lib/config/viro_haptics.dart';
    final offending = <String>[];

    final directory = Directory('lib');
    expect(directory.existsSync(), isTrue, reason: 'lancer depuis la racine');
    for (final entity in directory.listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      // Séparateurs normalisés : `\` sous Windows.
      if (entity.path.replaceAll(r'\', '/') == allowed) continue;
      final lines = entity.readAsLinesSync();
      for (var index = 0; index < lines.length; index++) {
        if (forbidden.hasMatch(lines[index])) {
          offending.add('${entity.path}:${index + 1}');
        }
      }
    }

    expect(
      offending,
      isEmpty,
      reason: 'Utiliser ViroHaptics (confirm / selection / threshold / '
          'success / error) : ${offending.join(', ')}',
    );
  });
}
