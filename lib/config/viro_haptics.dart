import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Vocabulaire unique du retour haptique de l'app.
///
/// Les features n'appellent jamais [HapticFeedback] directement : elles
/// choisissent l'intention (confirmer, sélectionner, seuil, succès, erreur).
/// Peu de vibrations, au bon moment : pas de vibration sur la navigation ni
/// sur les taps génériques. Les réglages système (vibrations iOS, retour
/// tactile Android) sont respectés par la plateforme.
abstract final class ViroHaptics {
  /// Réglage utilisateur « Vibrations » ; écrit uniquement par
  /// `hapticsEnabledProvider`.
  static bool enabled = true;

  /// Délai minimal entre deux vibrations (évite le « grésillement » sur un
  /// double tap ou un geste rapide).
  static const Duration minInterval = Duration(milliseconds: 60);

  /// Écart entre les deux impulsions du motif d'erreur.
  static const Duration _errorPulseGap = Duration(milliseconds: 90);

  static DateTime? _lastPulseAt;

  /// Action rapide validée (RSVP, envoi de message) : impulsion légère.
  static Future<void> confirm() => _pulse(HapticFeedback.lightImpact);

  /// Changement de valeur d'un sélecteur (segment, puce, choix) : tic.
  static Future<void> selection() => _pulse(HapticFeedback.selectionClick);

  /// Seuil de geste franchi (swipe, pull-to-refresh) ou appui long reconnu.
  static Future<void> threshold() => _pulse(HapticFeedback.mediumImpact);

  /// Résultat positif (toast de succès) : impulsion légère.
  static Future<void> success() => _pulse(HapticFeedback.lightImpact);

  /// Échec (toast d'erreur, RSVP refusé) : deux impulsions rapprochées.
  static Future<void> error() async {
    if (!await _pulse(HapticFeedback.mediumImpact)) return;
    await Future<void>.delayed(_errorPulseGap);
    if (!enabled) return;
    await HapticFeedback.mediumImpact();
  }

  /// Enveloppe un handler d'appui long : vibration de seuil puis [action].
  /// À passer tel quel à `onLongPress` hors `ViroPressable` (qui le fait déjà).
  static VoidCallback longPress(VoidCallback action) => () {
        threshold();
        action();
      };

  /// Remet à zéro l'anti-rafale (tests uniquement).
  @visibleForTesting
  static void resetForTest() {
    enabled = true;
    _lastPulseAt = null;
  }

  /// Joue [impulse] si le réglage l'autorise et hors rafale ; `true` si joué.
  static Future<bool> _pulse(Future<void> Function() impulse) async {
    if (!enabled) return false;
    final now = DateTime.now();
    final last = _lastPulseAt;
    if (last != null && now.difference(last) < minInterval) return false;
    _lastPulseAt = now;
    await impulse();
    return true;
  }
}
