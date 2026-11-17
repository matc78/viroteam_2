import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_focused_event_highlight.dart';

Widget _host({required bool disableAnimations}) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: disableAnimations),
        child: const Scaffold(
          body: PlanningFocusedEventHighlight(
            color: ViroColors.success,
            blinking: true,
            scrollIntoView: false,
            child: SizedBox(width: 100, height: 40),
          ),
        ),
      ),
    );

double _borderAlpha(WidgetTester tester) {
  final box = tester.widget<DecoratedBox>(
    find.descendant(
      of: find.byType(PlanningFocusedEventHighlight),
      matching: find.byType(DecoratedBox),
    ),
  );
  return (box.decoration as BoxDecoration).border!.top.color.a;
}

void main() {
  testWidgets('blinking : le liseré clignote', (tester) async {
    await tester.pumpWidget(_host(disableAnimations: false));
    final start = _borderAlpha(tester);
    expect(start, ViroMotion.rsvpHighlightBlinkMinOpacity);
    await tester.pump(ViroMotion.rsvpHighlightBlink);
    final peak = _borderAlpha(tester);
    await tester.pump(ViroMotion.rsvpHighlightBlink);

    expect(peak, greaterThan(start));
    expect(peak, closeTo(1, 0.01));
    expect(_borderAlpha(tester), lessThan(peak));
  });

  testWidgets('blinking : liseré fixe si les animations sont coupées',
      (tester) async {
    await tester.pumpWidget(_host(disableAnimations: true));
    expect(_borderAlpha(tester), 1);
    await tester.pump(ViroMotion.rsvpHighlightBlink);
    expect(_borderAlpha(tester), 1);
  });

  testWidgets('blinking : halo et voile teinté sur la tuile', (tester) async {
    await tester.pumpWidget(_host(disableAnimations: true));
    final box = tester.widget<DecoratedBox>(
      find.descendant(
        of: find.byType(PlanningFocusedEventHighlight),
        matching: find.byType(DecoratedBox),
      ),
    );
    final decoration = box.decoration as BoxDecoration;
    expect(decoration.border!.top.width, ViroMotion.rsvpHighlightBorderWidth);
    expect(decoration.boxShadow, isNotEmpty);

    final veil = tester.widget<ColoredBox>(
      find.descendant(
        of: find.byType(PlanningFocusedEventHighlight),
        matching: find.byType(ColoredBox),
      ),
    );
    expect(
      veil.color.a,
      closeTo(ViroMotion.rsvpHighlightFillMaxOpacity, 0.01),
    );
    expect(veil.color, ViroColors.success.withValues(alpha: veil.color.a));
  });
}
