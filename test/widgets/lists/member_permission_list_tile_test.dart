import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_glyphs.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';
import 'package:viro_team_v2/widgets/lists/member_permission_list_tile.dart';

void main() {
  Future<void> pump(WidgetTester tester, Widget tile) => tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(body: tile),
    ),
  );

  testWidgets('MemberPermissionListTile se coche et affiche son libellé', (
    tester,
  ) async {
    bool? changedTo;
    await pump(
      tester,
      MemberPermissionListTile(
        title: 'Gérer les cotisations',
        subtitle: 'Saisons, encaissements',
        glyph: ViroGlyph.piece,
        value: false,
        onChanged: (value) => changedTo = value,
      ),
    );

    expect(find.text('Gérer les cotisations'), findsOneWidget);
    expect(find.text('Saisons, encaissements'), findsOneWidget);
    expect(find.byType(SvgPicture), findsOneWidget);
    await tester.tap(find.byType(MemberPermissionListTile));
    expect(changedTo, isTrue);
  });

  testWidgets('cochée : un tap la décoche', (tester) async {
    bool? changedTo;
    await pump(
      tester,
      MemberPermissionListTile(
        title: 'Gérer le planning',
        value: true,
        onChanged: (value) => changedTo = value,
      ),
    );

    await tester.tap(find.byType(MemberPermissionListTile));
    expect(changedTo, isFalse);
  });

  testWidgets('état partiel : un tap complète la fonction', (tester) async {
    bool? changedTo;
    await pump(
      tester,
      MemberPermissionListTile(
        title: 'Responsable membres',
        value: null,
        compact: true,
        onChanged: (value) => changedTo = value,
      ),
    );

    final mark = tester.widget<ViroSelectionMark>(
      find.byType(ViroSelectionMark),
    );
    expect(mark.value, isNull);
    await tester.tap(find.byType(MemberPermissionListTile));
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

    final mark = tester.widget<ViroSelectionMark>(
      find.byType(ViroSelectionMark),
    );
    expect(mark.enabled, isFalse);
    // Le tap ne lève rien et ne fait rien.
    await tester.tap(find.byType(MemberPermissionListTile));
  });

  testWidgets('lecture seule avec onLockedTap : le tap le déclenche', (
    tester,
  ) async {
    var lockedTaps = 0;
    await pump(
      tester,
      MemberPermissionListTile(
        title: 'Créer des événements',
        value: true,
        onChanged: null,
        onLockedTap: () => lockedTaps++,
      ),
    );

    await tester.tap(find.byType(MemberPermissionListTile));
    expect(lockedTaps, 1);
  });

  testWidgets('sémantique : cochée / partielle', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(
      tester,
      MemberPermissionListTile(
        title: 'Responsable sportif',
        value: null,
        onChanged: (_) {},
      ),
    );

    expect(
      tester.getSemantics(find.byType(MemberPermissionListTile)),
      matchesSemantics(
        label: 'Responsable sportif',
        hasCheckedState: true,
        isCheckStateMixed: true,
        hasEnabledState: true,
        isEnabled: true,
        isButton: true,
        hasTapAction: true,
      ),
    );
    handle.dispose();
  });
}
