import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/rsvp_choice_button.dart';
import 'package:viro_team_v2/widgets/common/viro_swipe_to_reveal.dart';

import '../../helpers/haptics_recorder.dart';

void main() {
  final recorder = HapticsRecorder();

  setUp(() {
    ViroHaptics.resetForTest();
    recorder.calls.clear();
    recorder.attach();
  });

  tearDown(() {
    recorder.detach();
    ViroHaptics.resetForTest();
  });

  Widget wrap(Widget child) => MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(body: child),
      );

  testWidgets('RsvpChoiceButton vibre (léger) puis transmet le tap',
      (tester) async {
    var tapped = 0;
    await tester.pumpWidget(
      wrap(
        RsvpChoiceButton(
          label: 'Présent',
          color: ViroColors.success,
          onTap: () => tapped++,
        ),
      ),
    );

    await tester.tap(find.text('Présent'));
    await tester.pump();

    expect(tapped, 1);
    expect(recorder.calls, ['HapticFeedbackType.lightImpact']);
  });

  testWidgets('RsvpChoiceButton ne vibre pas quand le réglage est coupé',
      (tester) async {
    ViroHaptics.enabled = false;
    var tapped = 0;
    await tester.pumpWidget(
      wrap(
        RsvpChoiceButton(
          label: 'Présent',
          color: ViroColors.success,
          onTap: () => tapped++,
        ),
      ),
    );

    await tester.tap(find.text('Présent'));
    await tester.pump();

    expect(tapped, 1);
    expect(recorder.calls, isEmpty);
  });

  testWidgets('ViroSwipeToReveal vibre une seule fois au seuil',
      (tester) async {
    var committed = 0;
    await tester.pumpWidget(
      wrap(
        ViroSwipeToReveal(
          reveal: const ColoredBox(color: ViroColors.white),
          onCommit: () => committed++,
          child: const SizedBox.expand(child: Text('Accueil')),
        ),
      ),
    );

    final width = tester.getSize(find.byType(ViroSwipeToReveal)).width;
    final gesture =
        await tester.startGesture(tester.getCenter(find.text('Accueil')));

    // Sous le seuil : rien.
    await gesture.moveBy(const Offset(-40, 0));
    await tester.pump();
    expect(recorder.calls, isEmpty);

    // Franchissement du seuil : une vibration moyenne.
    await gesture.moveBy(Offset(-width * 0.35, 0));
    await tester.pump();
    expect(recorder.calls, ['HapticFeedbackType.mediumImpact']);

    // On continue au-delà : pas de nouvelle vibration.
    await gesture.moveBy(const Offset(-60, 0));
    await tester.pump();
    expect(recorder.calls, hasLength(1));

    // Retour sous le seuil puis relâché : pas d'ouverture, pas de vibration.
    await gesture.moveBy(Offset(width * 0.3, 0));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();

    expect(committed, 0);
    expect(recorder.calls, hasLength(1));
  });
}
