import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Réglage « Vibrations » de l'utilisateur, persisté sur l'appareil et
/// reflété dans [ViroHaptics.enabled].
class HapticsEnabledNotifier extends Notifier<bool> {
  @override
  bool build() {
    final enabled = ref.read(hapticsPreferenceServiceProvider).readSync();
    ViroHaptics.enabled = enabled;
    return enabled;
  }

  /// Applique [enabled] immédiatement (avec une vibration d'aperçu à
  /// l'activation) puis l'enregistre.
  Future<void> select({required bool enabled}) async {
    if (state == enabled) return;
    state = enabled;
    ViroHaptics.enabled = enabled;
    if (enabled) ViroHaptics.confirm();
    await ref.read(hapticsPreferenceServiceProvider).write(enabled);
  }
}

final hapticsEnabledProvider = NotifierProvider<HapticsEnabledNotifier, bool>(
  HapticsEnabledNotifier.new,
);
