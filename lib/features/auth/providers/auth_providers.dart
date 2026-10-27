import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

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

enum SignUpIntent { founder, join }

class SignUpIntentNotifier extends Notifier<SignUpIntent> {
  @override
  SignUpIntent build() => SignUpIntent.founder;

  void setIntent(SignUpIntent intent) => state = intent;
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
