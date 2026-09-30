// Driver des captures d'écran store (voir integration_test/store_screenshots_test.dart).
//
// Écrit chaque capture en PNG dans le dossier de la variable d'environnement
// `SHOT_DIR` (défaut : ./screenshots). Le driver tourne sur le Mac : les
// `--dart-define` de `flutter drive` ne lui parviennent pas.
import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final dir = Platform.environment['SHOT_DIR'] ?? 'screenshots';
  await integrationDriver(
    onScreenshot: (String name, List<int> bytes, [Map<String, Object?>? args]) async {
      final file = File('$dir/$name.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes);
      // ignore: avoid_print
      print('SHOT_SAVED ${file.path} (${bytes.length} bytes)');
      return true;
    },
  );
}
