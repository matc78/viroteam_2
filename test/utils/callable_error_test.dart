import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/callable_error.dart';

void main() {
  group('callableErrorMessage', () {
    test('code technique unknown → fallback (pas le message Java)', () {
      // ignore: invalid_use_of_protected_member
      final error = FirebaseFunctionsException(
        code: 'unknown',
        message:
            'java.util.concurrent.ExecutionException: 1 out of 2 underlying tasks failed',
      );
      expect(
        callableErrorMessage(error, fallback: 'Impossible'),
        'Impossible',
      );
    });

    test('code métier permission-denied → message serveur', () {
      // ignore: invalid_use_of_protected_member
      final error = FirebaseFunctionsException(
        code: 'permission-denied',
        message: 'Invitation réservée à un autre e-mail',
      );
      expect(
        callableErrorMessage(error, fallback: 'Impossible'),
        'Invitation réservée à un autre e-mail',
      );
    });

    test('code métier sans message → fallback', () {
      // ignore: invalid_use_of_protected_member
      final error = FirebaseFunctionsException(
        code: 'failed-precondition',
        message: '   ',
      );
      expect(
        callableErrorMessage(error, fallback: 'Action impossible'),
        'Action impossible',
      );
    });

    test('erreur non-Functions → fallback (pas toString)', () {
      expect(
        callableErrorMessage(Exception('stack secrète'), fallback: 'Oops'),
        'Oops',
      );
    });

    test('codes techniques internal / unavailable', () {
      for (final code in ['internal', 'unavailable', 'deadline-exceeded',
          'resource-exhausted']) {
        // ignore: invalid_use_of_protected_member
        final error = FirebaseFunctionsException(
          code: code,
          message: 'détail technique',
        );
        expect(
          callableErrorMessage(error, fallback: 'X'),
          'X',
          reason: 'code $code',
        );
      }
    });
  });
}
