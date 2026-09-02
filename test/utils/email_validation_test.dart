import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/utils/email_validation.dart';

void main() {
  group('email_validation', () {
    test('normalizeEmail : trim + minuscules', () {
      expect(normalizeEmail('  Marie.Curie@Gmail.COM '), 'marie.curie@gmail.com');
    });

    test('isValidEmailFormat accepte x@y.z', () {
      expect(isValidEmailFormat('a@b.fr'), isTrue);
      expect(isValidEmailFormat(' prenom.nom+tag@sous.domaine.org '), isTrue);
    });

    test('isValidEmailFormat refuse les formats invalides', () {
      expect(isValidEmailFormat(''), isFalse);
      expect(isValidEmailFormat('@b.fr'), isFalse);
      expect(isValidEmailFormat('a@b'), isFalse);
      expect(isValidEmailFormat('a b@c.fr'), isFalse);
      expect(isValidEmailFormat('a@@b.fr'), isFalse);
      expect(isValidEmailFormat('marie'), isFalse);
    });

    test('requiredEmailError : message FR selon le cas', () {
      expect(requiredEmailError(''), 'L\'e-mail est obligatoire.');
      expect(requiredEmailError('   '), 'L\'e-mail est obligatoire.');
      expect(requiredEmailError('pas-un-mail'), 'Saisis un e-mail valide.');
      expect(requiredEmailError('ok@viro.team'), isNull);
    });
  });

  group('MemberService.requireNormalizedEmail', () {
    test('lève ArgumentError si vide ou null', () {
      expect(
        () => MemberService.requireNormalizedEmail(null),
        throwsA(isA<ArgumentError>()),
      );
      expect(
        () => MemberService.requireNormalizedEmail('   '),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('lève ArgumentError si le format est invalide', () {
      expect(
        () => MemberService.requireNormalizedEmail('marie@curie'),
        throwsA(
          isA<ArgumentError>().having(
            (error) => error.message,
            'message',
            'Saisis un e-mail valide.',
          ),
        ),
      );
    });

    test('retourne l’e-mail normalisé', () {
      expect(
        MemberService.requireNormalizedEmail(' Marie@Curie.FR '),
        'marie@curie.fr',
      );
    });
  });
}
