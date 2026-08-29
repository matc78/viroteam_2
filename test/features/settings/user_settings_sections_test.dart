import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/settings/widgets/account_session_section.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/auth_service.dart';

void main() {
  group('AccountSessionSection', () {
    testWidgets('affiche les actions session dans une carte', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWithValue(_FakeAuthService()),
          ],
          child: const MaterialApp(
            home: Scaffold(body: AccountSessionSection()),
          ),
        ),
      );

      expect(find.text('Session'), findsOneWidget);
      expect(find.text('Se déconnecter'), findsOneWidget);
      expect(find.text('Supprimer mon compte'), findsOneWidget);
      expect(
        find.text('Actions sensibles — une confirmation te sera demandée.'),
        findsOneWidget,
      );
    });

    testWidgets('demande confirmation avant déconnexion', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWithValue(_FakeAuthService()),
          ],
          child: const MaterialApp(
            home: Scaffold(body: AccountSessionSection()),
          ),
        ),
      );

      await tester.tap(find.text('Se déconnecter'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Tu quittes la session'), findsOneWidget);
      expect(find.text('Annuler'), findsOneWidget);
    });
  });
}

class _FakeAuthService implements AuthService {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
