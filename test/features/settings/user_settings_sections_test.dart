import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/settings/widgets/danger_zone_section.dart';
import 'package:viro_team_v2/features/settings/widgets/delete_account_form.dart';
import 'package:viro_team_v2/features/settings/widgets/sign_out_button.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/auth_service.dart';

void main() {
  group('SignOutButton', () {
    testWidgets('demande confirmation avant déconnexion', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWithValue(_FakeAuthService()),
          ],
          child: MaterialApp(
            theme: ViroTheme.light,
            home: const Scaffold(body: SignOutButton()),
          ),
        ),
      );

      await tester.tap(find.text('Se déconnecter'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Tu quittes la session'), findsOneWidget);
      expect(find.text('Annuler'), findsOneWidget);
    });
  });

  group('DangerZoneSection', () {
    testWidgets('mène vers la suppression sans action directe', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ViroTheme.light,
          home: const Scaffold(body: DangerZoneSection()),
        ),
      );

      expect(find.text('Zone sensible'), findsOneWidget);
      expect(find.text('Supprimer mon compte'), findsOneWidget);
      expect(find.text('Ces actions sont définitives.'), findsOneWidget);
    });
  });

  group('isDeleteConfirmationTyped', () {
    test('accepte SUPPRIMER quelle que soit la casse', () {
      expect(isDeleteConfirmationTyped('SUPPRIMER'), isTrue);
      expect(isDeleteConfirmationTyped('  supprimer '), isTrue);
    });

    test('refuse un mot incomplet ou vide', () {
      expect(isDeleteConfirmationTyped(''), isFalse);
      expect(isDeleteConfirmationTyped('SUPPRIM'), isFalse);
      expect(isDeleteConfirmationTyped('oui'), isFalse);
    });
  });
}

class _FakeAuthService implements AuthService {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
