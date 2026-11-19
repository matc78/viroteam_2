import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/invitation_service.dart';
import 'package:viro_team_v2/utils/callable_error.dart';

void main() {
  group('InvitationService.mapAcceptError', () {
    test('e-mail non confirmé → erreur d’origine (ouvre la confirmation)', () {
      final error = FirebaseFunctionsException(
        code: 'failed-precondition',
        message: 'Confirme ton adresse e-mail pour accepter l\'invitation',
        details: {'reason': emailNotVerifiedReason},
      );

      final mapped = InvitationService.mapAcceptError(error);

      expect(mapped, same(error));
      expect(isEmailNotVerifiedError(mapped), isTrue);
    });

    test('permission-denied → invitation réservée à un autre e-mail', () {
      final mapped = InvitationService.mapAcceptError(
        FirebaseFunctionsException(code: 'permission-denied', message: 'x'),
      );

      expect(mapped, isA<InvitationAcceptException>());
      expect(
        (mapped as InvitationAcceptException).message,
        AppCopy.join.reservedForOtherEmail,
      );
    });

    test('autre refus métier → message serveur', () {
      final mapped = InvitationService.mapAcceptError(
        FirebaseFunctionsException(
          code: 'failed-precondition',
          message: 'Invitation expirée',
        ),
      );

      expect(
        (mapped as InvitationAcceptException).message,
        'Invitation expirée',
      );
    });
  });
}
