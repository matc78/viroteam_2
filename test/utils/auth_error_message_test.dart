import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/utils/auth_error_message.dart';

void main() {
  group('AuthErrorMessage.forPasswordReset', () {
    test('user-not-found → null (succès neutre)', () {
      expect(
        AuthErrorMessage.forPasswordReset(
          FirebaseAuthException(code: 'user-not-found'),
        ),
        isNull,
      );
      expect(
        AuthErrorMessage.forPasswordReset(
          FirebaseAuthException(code: 'auth/user-not-found'),
        ),
        isNull,
      );
    });

    test('mappe les erreurs réseau et rate-limit', () {
      expect(
        AuthErrorMessage.forPasswordReset(
          FirebaseAuthException(code: 'network-request-failed'),
        ),
        AppCopy.auth.authErrorNetworkFailed,
      );
      expect(
        AuthErrorMessage.forPasswordReset(
          FirebaseAuthException(code: 'too-many-requests'),
        ),
        AppCopy.auth.authErrorTooManyRequests,
      );
    });

    test('mappe e-mail invalide et compte désactivé', () {
      expect(
        AuthErrorMessage.forPasswordReset(
          FirebaseAuthException(code: 'invalid-email'),
        ),
        AppCopy.auth.authErrorInvalidEmail,
      );
      expect(
        AuthErrorMessage.forPasswordReset(
          FirebaseAuthException(code: 'user-disabled'),
        ),
        AppCopy.auth.authErrorUserDisabled,
      );
    });

    test('ne renvoie pas wrong-credentials pour un code inconnu', () {
      expect(
        AuthErrorMessage.forPasswordReset(
          FirebaseAuthException(code: 'internal-error'),
        ),
        AppCopy.auth.forgotPasswordFailed,
      );
    });
  });
}
