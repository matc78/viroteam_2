import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Enregistre les vibrations envoyées à la plateforme pendant un test.
///
/// Chaque entrée est le type transmis (`HapticFeedbackType.lightImpact`,
/// `HapticFeedbackType.selectionClick`…), ou `null` pour `vibrate()`.
class HapticsRecorder {
  final List<String?> calls = [];

  /// Branche l'intercepteur sur le canal plateforme ; à appeler en `setUp`.
  void attach() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'HapticFeedback.vibrate') {
        calls.add(call.arguments as String?);
      }
      return null;
    });
  }

  /// Retire l'intercepteur ; à appeler en `tearDown`.
  void detach() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  }
}
