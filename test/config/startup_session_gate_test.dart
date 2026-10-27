import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/startup_session_gate.dart';
import 'package:viro_team_v2/services/startup_session_failure.dart';

void main() {
  group('StartupSessionGate', () {
    test('le premier chargement attend, sans bloquer', () {
      expect(
        StartupSessionGate.blockFailure(
          firestoreAuth: const AsyncLoading<Object?>(),
          profile: const AsyncLoading<Object?>(),
        ),
        isNull,
      );
      expect(
        StartupSessionGate.stillResolving(
          updateKnown: false,
          authLoading: true,
          signedIn: false,
          firestoreAuthLoading: true,
          profileLoading: true,
          blocked: false,
        ),
        isTrue,
      );
    });

    test('un compte connecté attend encore le profil', () {
      expect(
        StartupSessionGate.stillResolving(
          updateKnown: true,
          authLoading: false,
          signedIn: true,
          firestoreAuthLoading: false,
          profileLoading: true,
          blocked: false,
        ),
        isTrue,
      );
    });

    test('un getIdToken refusé bloque, même si le profil vaut null', () {
      final failure = StartupSessionGate.blockFailure(
        firestoreAuth: AsyncError<Object?>(
          StateError('token'),
          StackTrace.empty,
        ),
        profile: const AsyncData<Object?>(null),
      );

      expect(failure, isNotNull);
      expect(failure!.error, isA<StateError>());
      expect(
        StartupSessionGate.stillResolving(
          updateKnown: true,
          authLoading: false,
          signedIn: true,
          firestoreAuthLoading: true,
          profileLoading: false,
          blocked: true,
        ),
        isFalse,
      );
    });

    test('une fiche en erreur bloque', () {
      final failure = StartupSessionGate.blockFailure(
        firestoreAuth: const AsyncData<Object?>('uid'),
        profile: AsyncError<Object?>(StateError('rules'), StackTrace.empty),
      );

      expect(failure?.error.toString(), contains('rules'));
    });

    test('une session prête ne bloque pas et ne charge plus', () {
      expect(
        StartupSessionGate.blockFailure(
          firestoreAuth: const AsyncData<Object?>('uid'),
          profile: const AsyncData<Object?>('user'),
        ),
        isNull,
      );
      expect(
        StartupSessionGate.stillResolving(
          updateKnown: true,
          authLoading: false,
          signedIn: true,
          firestoreAuthLoading: false,
          profileLoading: false,
          blocked: false,
        ),
        isFalse,
      );
    });
  });

  group('StartupSessionFailure', () {
    test('la reason garde le code et le message', () {
      final error = FirebaseException(
        plugin: 'cloud_firestore',
        code: 'permission-denied',
        message: 'Missing or insufficient permissions.',
      );

      expect(
        StartupSessionFailure.shortLabel(error),
        'cloud_firestore · permission-denied',
      );
      expect(
        StartupSessionFailure.crashlyticsReason(error),
        'startup_session_blocked [cloud_firestore/permission-denied] '
        'Missing or insufficient permissions.',
      );
    });

    test('sans message, le code reste dans la reason', () {
      final error = FirebaseException(
        plugin: 'firebase_app_check',
        code: 'unknown',
      );

      expect(
        StartupSessionFailure.crashlyticsReason(error),
        'startup_session_blocked [firebase_app_check/unknown]',
      );
      expect(
        StartupSessionFailure.shortLabel(error),
        'firebase_app_check · unknown',
      );
    });
  });
}
