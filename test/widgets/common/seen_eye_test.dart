import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/seen_eye.dart';

Future<void> _pumpEye(
  WidgetTester tester, {
  required bool seen,
  bool disableAnimations = false,
  Duration delay = Duration.zero,
}) =>
    tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: disableAnimations),
          child: Scaffold(
            body: Center(child: SeenEye(seen: seen, delay: delay)),
          ),
        ),
      ),
    );

SeenEyePainter _painter(WidgetTester tester) => tester
    .widget<CustomPaint>(
      find.descendant(
        of: find.byType(SeenEye),
        matching: find.byType(CustomPaint),
      ),
    )
    .painter! as SeenEyePainter;

void main() {
  testWidgets('pas vu : œil fermé, aucune animation', (tester) async {
    await _pumpEye(tester, seen: false);

    expect(_painter(tester).lidOpenness, 0);
    expect(_painter(tester).irisScale, 0);
    expect(tester.hasRunningAnimations, isFalse);
    expect(find.bySemanticsLabel(AppCopy.common.notSeenYet), findsOneWidget);
    expect(find.byType(Tooltip), findsNothing);
  });

  testWidgets('vu : l’œil s’ouvre puis reste ouvert', (tester) async {
    await _pumpEye(tester, seen: true);

    expect(tester.hasRunningAnimations, isTrue);
    expect(_painter(tester).lidOpenness, 0);

    await tester.pumpAndSettle();

    expect(_painter(tester).lidOpenness, 1);
    expect(_painter(tester).irisScale, 1);
    expect(tester.hasRunningAnimations, isFalse);
    expect(find.bySemanticsLabel(AppCopy.common.seen), findsOneWidget);
    expect(find.byType(Tooltip), findsOneWidget);
  });

  testWidgets('vu avec délai : reste fermé pendant le délai', (tester) async {
    const delay = Duration(milliseconds: 300);
    await _pumpEye(tester, seen: true, delay: delay);

    await tester.pump(delay - const Duration(milliseconds: 10));
    expect(_painter(tester).lidOpenness, 0);

    await tester.pump(ViroMotion.seenEyeOpen);
    await tester.pumpAndSettle();
    expect(_painter(tester).lidOpenness, 1);
  });

  testWidgets('ne rejoue pas l’animation au rebuild', (tester) async {
    await _pumpEye(tester, seen: true);
    await tester.pumpAndSettle();

    await _pumpEye(tester, seen: true);
    await tester.pump(const Duration(milliseconds: 100));

    // MaterialApp anime lui-même son thème au rebuild : on vérifie l'œil seul.
    expect(_painter(tester).progress.status, AnimationStatus.completed);
    expect(_painter(tester).lidOpenness, 1);
  });

  testWidgets('disableAnimations : état ouvert immédiat', (tester) async {
    await _pumpEye(tester, seen: true, disableAnimations: true);

    expect(tester.hasRunningAnimations, isFalse);
    expect(_painter(tester).lidOpenness, 1);
    expect(_painter(tester).irisScale, 1);
  });
}
