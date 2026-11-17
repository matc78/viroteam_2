import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/sign_up_intent_preference_service.dart';

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges();
});

/// Session Firestore prête : utilisateur connecté avec token ID chargé.
///
/// Évite les `PERMISSION_DENIED` au cold start quand [authStateChanges]
/// émet l'utilisateur avant que Firestore n'ait reçu le jeton.
///
/// Pas de retry : un refus (App Check, règles) doit rester une erreur.
/// Sinon Riverpod repasse `isLoading` et le routeur renvoie sur `/loading`.
final firestoreAuthReadyProvider = StreamProvider<User?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges().asyncMap((
    user,
  ) async {
    if (user == null) return null;
    await user.getIdToken();
    return user;
  });
}, retry: _keepStartupFailure);

/// Profil `users/{uid}`. Même règle : un refus ne relance pas le flux.
final viroUserProvider = StreamProvider<ViroUser?>((ref) {
  final auth = ref.watch(firestoreAuthReadyProvider);
  return auth.when(
    data: (user) {
      if (user == null) return Stream.value(null);
      return ref.watch(userServiceProvider).watchUser(user.uid);
    },
    loading: () => Stream.value(null),
    error: (error, stackTrace) => Stream.value(null),
  );
}, retry: _keepStartupFailure);

/// Empêche le retry automatique de Riverpod sur les flux de démarrage.
Duration? _keepStartupFailure(int retryCount, Object error) => null;

final viroUserFutureProvider = FutureProvider<ViroUser?>((ref) async {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return null;
  return ref.watch(userServiceProvider).getUser(auth.uid);
});

/// Uid du compte connecté (`null` si déconnecté ou en chargement).
///
/// Clé des états de session à remettre à zéro au changement de compte
/// (club actif, cible Moi | enfant) : les notifiers concernés le `watch`.
final authUidProvider = Provider<String?>(
  (ref) => ref.watch(authStateProvider.select((auth) => auth.value?.uid)),
);

enum SignUpIntent { founder, join }

/// Intention d'inscription (créer un club ou rejoindre), persistée sur
/// l'appareil : un invité qui relance l'app avant d'avoir rejoint son club
/// ne doit pas être renvoyé sur la création de club.
class SignUpIntentNotifier extends Notifier<SignUpIntent> {
  @override
  SignUpIntent build() {
    final stored = ref.read(signUpIntentPreferenceServiceProvider).readSync();
    return stored == SignUpIntentPreferenceService.joinValue
        ? SignUpIntent.join
        : SignUpIntent.founder;
  }

  /// Applique [intent] immédiatement puis l'enregistre sur l'appareil.
  void setIntent(SignUpIntent intent) {
    if (state == intent) return;
    state = intent;
    unawaited(
      ref.read(signUpIntentPreferenceServiceProvider).write(
            intent == SignUpIntent.join
                ? SignUpIntentPreferenceService.joinValue
                : SignUpIntentPreferenceService.founderValue,
          ),
    );
  }
}

final signUpIntentProvider =
    NotifierProvider<SignUpIntentNotifier, SignUpIntent>(
      SignUpIntentNotifier.new,
    );

class PendingInviteCodeNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void setCode(String? code) => state = code;
}

final pendingInviteCodeProvider =
    NotifierProvider<PendingInviteCodeNotifier, String?>(
      PendingInviteCodeNotifier.new,
    );
