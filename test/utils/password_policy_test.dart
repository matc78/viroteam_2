import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/password_policy.dart';

void main() {
  group('PasswordPolicy', () {
    test('accepte un mot de passe conforme', () {
      expect(PasswordPolicy.validate('BonMotDePasse1'), isNull);
      expect(PasswordPolicy.isValid('BonMotDePasse1'), isTrue);
    });

    test('refuse un mot de passe trop court', () {
      expect(PasswordPolicy.validate('Ab1'), isNotNull);
    });

    test('refuse sans majuscule', () {
      expect(PasswordPolicy.validate('motdepasse1'), isNotNull);
    });

    test('refuse sans minuscule', () {
      expect(PasswordPolicy.validate('MOTDEPASSE1'), isNotNull);
    });

    test('refuse sans chiffre', () {
      expect(PasswordPolicy.validate('MotDePasse'), isNotNull);
    });
  });
}
