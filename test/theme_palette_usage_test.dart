import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Garde-fou dark mode : les écrans et widgets lisent les couleurs neutres et
/// de marque via `context.viroPalette`, jamais via les constantes claires de
/// `ViroColors` (qui resteraient blanches / grises en mode sombre).
void main() {
  test('aucune couleur neutre ou de marque figée dans features / widgets', () {
    final forbidden = RegExp(
      r'ViroColors\.(gray\d+|primary\d+|surface\w*|scaffold\w*)\b',
    );
    final offending = <String>[];

    for (final root in ['lib/features', 'lib/widgets', 'lib/screens']) {
      final directory = Directory(root);
      expect(directory.existsSync(), isTrue, reason: 'lancer depuis la racine');
      for (final entity in directory.listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        final lines = entity.readAsLinesSync();
        for (var index = 0; index < lines.length; index++) {
          if (forbidden.hasMatch(lines[index])) {
            offending.add('${entity.path}:${index + 1}');
          }
        }
      }
    }

    expect(
      offending,
      isEmpty,
      reason: 'Utiliser context.viroPalette (ViroPalette) : '
          '${offending.join(', ')}',
    );
  });
}
