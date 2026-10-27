import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

/// Signalement lisible d'un refus de session au démarrage (App Check, règles).
class StartupSessionFailure {
  const StartupSessionFailure._();

  static String? _reportedReason;

  /// Ligne courte pour l'écran (`cloud_firestore · permission-denied`).
  static String shortLabel(Object error) {
    if (error is FirebaseException) {
      return '${error.plugin} · ${error.code}';
    }
    return error.runtimeType.toString();
  }

  /// Reason Crashlytics : code, plugin et message, sans donnée perso.
  static String crashlyticsReason(Object error) {
    if (error is FirebaseException) {
      final head = 'startup_session_blocked [${error.plugin}/${error.code}]';
      final detail = error.message?.trim();
      if (detail == null || detail.isEmpty) return head;
      return '$head $detail';
    }
    return 'startup_session_blocked [${error.runtimeType}] $error';
  }

  /// Enregistre [error] une fois. [resetReport] réarme au réessai utilisateur.
  static void report(Object error, StackTrace stackTrace) {
    final reason = crashlyticsReason(error);
    if (_reportedReason == reason) return;
    _reportedReason = reason;
    debugPrint(reason);
    try {
      FirebaseCrashlytics.instance.recordError(
        error,
        stackTrace,
        fatal: false,
        reason: reason,
      );
    } catch (_) {
      // Le monitoring ne doit jamais bloquer l'écran.
    }
  }

  /// Autorise un nouveau signalement après un appui sur Réessayer.
  static void resetReport() {
    _reportedReason = null;
  }
}
