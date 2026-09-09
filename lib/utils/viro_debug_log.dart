import 'package:flutter/foundation.dart';

/// Logs colorés pour la Debug Console (debug uniquement).
abstract final class ViroDebugLog {
  static const _red = '\x1B[31m';
  static const _yellow = '\x1B[33m';
  static const _cyan = '\x1B[36m';
  static const _bold = '\x1B[1m';
  static const _reset = '\x1B[0m';

  static const _errorBanner =
      '════════════════════════════════ EXCEPTION CAUGHT ════════════════════════════════';
  static const _errorFooter =
      '════════════════════════════════════════════════════════════════════════════════';

  /// Affiche un message d'erreur en rouge gras, avec stack optionnelle.
  static void error(Object message, [StackTrace? stackTrace]) {
    if (!kDebugMode) return;
    debugPrint('$_red$_bold$_errorBanner$_reset');
    debugPrint('$_red$_bold[ERROR]$_reset$_red $message$_reset');
    if (stackTrace != null) {
      debugPrint('$_red$stackTrace$_reset');
    }
    debugPrint('$_red$_bold$_errorFooter$_reset');
  }

  /// Affiche un avertissement en jaune.
  static void warn(Object message) {
    if (!kDebugMode) return;
    debugPrint('$_yellow$_bold[WARN]$_reset$_yellow $message$_reset');
  }

  /// Affiche une info en cyan.
  static void info(Object message) {
    if (!kDebugMode) return;
    debugPrint('$_cyan[INFO]$_reset $message');
  }
}
