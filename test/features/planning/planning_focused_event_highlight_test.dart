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
    await tester.pump(ViroMotion.rsvpHighlightBlink);
    final peak = _borderAlpha(tester);
    await tester.pump(ViroMotion.rsvpHighlightBlink);

    expect(peak, greaterThan(start));
    expect(_borderAlpha(tester), lessThan(peak));
  });

  testWidgets('blinking : liseré fixe si les animations sont coupées',
      (tester) async {
    await tester.pumpWidget(_host(disableAnimations: true));
    expect(_borderAlpha(tester), 1);
    await tester.pump(ViroMotion.rsvpHighlightBlink);
    expect(_borderAlpha(tester), 1);
  });
}
