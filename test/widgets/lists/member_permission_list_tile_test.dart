import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/widgets/lists/member_permission_list_tile.dart';

void main() {
  Future<void> pump(WidgetTester tester, Widget tile) =>
      tester.pumpWidget(MaterialApp(home: Scaffold(body: tile)));

  testWidgets('MemberPermissionListTile se coche et affiche son libellé', (
    tester,
  ) async {
    bool? changedTo;
    await pump(
      tester,
      MemberPermissionListTile(
        title: 'Gérer les cotisations',
        subtitle: 'Saisons, encaissements',
        value: false,
        onChanged: (value) => changedTo = value,
      ),
    );

    expect(find.text('Gérer les cotisations'), findsOneWidget);
    expect(find.text('Saisons, encaissements'), findsOneWidget);
    await tester.tap(find.byType(Checkbox));
    expect(changedTo, isTrue);
  });

  testWidgets('état partiel : un tap complète la fonction', (tester) async {
    bool? changedTo;
    await pump(
      tester,
      MemberPermissionListTile(
        title: 'Responsable membres',
        value: null,
        onChanged: (value) => changedTo = value,
      ),
    );

    await tester.tap(find.byType(Checkbox));
    expect(changedTo, isTrue);
  });

  testWidgets('lecture seule sans onChanged', (tester) async {
    await pump(
      tester,
      const MemberPermissionListTile(
        title: 'Voir les cotisations',
        value: true,
        onChanged: null,
      ),
    );

    final checkbox = tester.widget<Checkbox>(find.byType(Checkbox));
    expect(checkbox.onChanged, isNull);
  });
}
