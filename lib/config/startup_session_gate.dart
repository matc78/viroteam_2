import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Décision de démarrage : attendre, ou bloquer si Firestore / App Check refuse.
class StartupSessionGate {
  const StartupSessionGate._();

  /// Erreur qui empêche d'ouvrir la session, ou `null` si rien n'a échoué.
  ///
  /// [firestoreAuth] prime : un `getIdToken()` refusé est avalé en profil
  /// `null`, et ne doit pas être pris pour « pas de fiche ».
  static ({Object error, StackTrace stackTrace})? blockFailure<T, U>({
    required AsyncValue<T> firestoreAuth,
    required AsyncValue<U> profile,
  }) {
    if (firestoreAuth.hasError) {
      return _failureOf(firestoreAuth);
    }
    if (profile.hasError) {
      return _failureOf(profile);
    }
    return null;
  }

  /// Erreur et pile, ou `null` si l'un des deux manque.
  static ({Object error, StackTrace stackTrace})? _failureOf<T>(
    AsyncValue<T> value,
  ) {
    final error = value.error;
    final stackTrace = value.stackTrace;
    if (error == null || stackTrace == null) return null;
    return (error: error, stackTrace: stackTrace);
  }

  /// `true` tant que le premier jet n'a ni donnée ni erreur de blocage.
  ///
  /// [blocked] coupe l'attente : un refus ne doit pas renvoyer sur `/loading`.
  static bool stillResolving({
    required bool updateKnown,
    required bool authLoading,
    required bool signedIn,
    required bool firestoreAuthLoading,
    required bool profileLoading,
    required bool blocked,
  }) {
    if (blocked) return false;
    return !updateKnown ||
        authLoading ||
        (signedIn && (firestoreAuthLoading || profileLoading));
  }
}
