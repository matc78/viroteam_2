import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Garde-fou sélection : pas de case à cocher Material dans l'UI. Une
/// sélection passe par `ViroSelectionMark` / `ViroSelectableRow`
/// (`lib/widgets/common/`).
void main() {
  test('aucune Checkbox / CheckboxListTile dans l’UI', () {
    final forbidden = RegExp(r'\bCheckbox(ListTile)?(\.adaptive)?\(');
    const roots = ['lib/features', 'lib/widgets', 'lib/screens'];
    final offending = <String>[];

    for (final root in roots) {
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
      reason: 'Utiliser ViroSelectionMark ou ViroSelectableRow : '
          '${offending.join(', ')}',
    );
  });
}
