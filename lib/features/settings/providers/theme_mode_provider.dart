import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Thème choisi par l'utilisateur (Système / Clair / Sombre), persisté sur
/// l'appareil.
class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => ref.read(themePreferenceServiceProvider).readSync();

  /// Applique [mode] immédiatement puis l'enregistre.
  Future<void> select(ThemeMode mode) async {
    if (state == mode) return;
    state = mode;
    await ref.read(themePreferenceServiceProvider).write(mode);
  }
}

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(
  ThemeModeNotifier.new,
);
