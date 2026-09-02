import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/members/widgets/add_member_sheet.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

void main() {
  const club = Club(
    id: 'c1',
    name: 'Test Club',
    sport: 'Football',
    city: 'Paris',
  );

  testWidgets('bouton Créer et inviter désactivé tant que l’e-mail est absent ou invalide',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: ViroTheme.light,
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => showAddMemberSheet(context, club: club),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final addButton = find.widgetWithText(ViroPrimaryButton, 'Créer et inviter');
    final button = tester.widget<ViroPrimaryButton>(addButton);
    expect(button.onPressed, isNull);

    await tester.enterText(find.byType(TextField).first, 'Jean');
    await tester.pump();

    expect(tester.widget<ViroPrimaryButton>(addButton).onPressed, isNull);

    await tester.enterText(find.byType(TextField).at(1), 'Dupont');
    await tester.pump();

    // Prénom + nom sans e-mail : toujours désactivé (e-mail obligatoire).
    expect(tester.widget<ViroPrimaryButton>(addButton).onPressed, isNull);
    expect(find.text('E-mail *'), findsOneWidget);

    // E-mail mal formé : erreur affichée, bouton désactivé.
    await tester.enterText(find.byType(TextField).at(2), 'jean@dupont');
    await tester.pump();
    expect(tester.widget<ViroPrimaryButton>(addButton).onPressed, isNull);
    expect(find.text('Saisis un e-mail valide.'), findsOneWidget);

    // E-mail valide : bouton activé.
    await tester.enterText(find.byType(TextField).at(2), 'Jean@Dupont.fr');
    await tester.pump();
    expect(tester.widget<ViroPrimaryButton>(addButton).onPressed, isNotNull);
    expect(find.text('Saisis un e-mail valide.'), findsNothing);
  });
}
