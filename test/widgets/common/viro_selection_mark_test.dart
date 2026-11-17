import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';

void main() {
  Future<void> pump(WidgetTester tester, bool? value, {bool enabled = true}) =>
      tester.pumpWidget(
        MaterialApp(
          theme: ViroTheme.light,
          home: Scaffold(
            body: Center(
              child: ViroSelectionMark(value: value, enabled: enabled),
            ),
          ),
        ),
      );

  testWidgets('garde sa taille dans les trois états', (tester) async {
    for (final value in [false, true, null]) {
      await pump(tester, value);
      await tester.pumpAndSettle();
      expect(
        tester.getSize(find.byType(ViroSelectionMark)),
        const Size.square(24),
      );
    }
  });

  testWidgets('anime la bascule puis se stabilise', (tester) async {
    await pump(tester, false);
    await pump(tester, true);
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.hasRunningAnimations, isTrue);
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('verrouillée : atténuée', (tester) async {
    await pump(tester, true, enabled: false);
    final opacity = tester.widget<Opacity>(
      find.descendant(
        of: find.byType(ViroSelectionMark),
        matching: find.byType(Opacity),
      ),
    );
    expect(opacity.opacity, lessThan(1));
  });

  testWidgets('purement visuelle : rien pour le lecteur d’écran',
      (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester, true);
    expect(
      find.descendant(
        of: find.byType(ViroSelectionMark),
        matching: find.byType(ExcludeSemantics),
      ),
      findsOneWidget,
    );
    handle.dispose();
  });
}
