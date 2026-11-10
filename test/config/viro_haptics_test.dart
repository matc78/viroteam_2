import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';

import '../helpers/haptics_recorder.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

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

  group('ViroHaptics', () {
    test('chaque intention envoie le bon type de vibration', () async {
      final expectations = <Future<void> Function(), String>{
        ViroHaptics.confirm: 'HapticFeedbackType.lightImpact',
        ViroHaptics.selection: 'HapticFeedbackType.selectionClick',
        ViroHaptics.threshold: 'HapticFeedbackType.mediumImpact',
        ViroHaptics.success: 'HapticFeedbackType.lightImpact',
      };

      for (final entry in expectations.entries) {
        ViroHaptics.resetForTest();
        recorder.calls.clear();
        await entry.key();
        expect(recorder.calls, [entry.value]);
      }
    });

    test('error joue deux impulsions moyennes', () async {
      await ViroHaptics.error();

      expect(recorder.calls, [
        'HapticFeedbackType.mediumImpact',
        'HapticFeedbackType.mediumImpact',
      ]);
    });

    test('aucune vibration quand le réglage est coupé', () async {
      ViroHaptics.enabled = false;

      await ViroHaptics.confirm();
      await ViroHaptics.selection();
      await ViroHaptics.threshold();
      await ViroHaptics.success();
      await ViroHaptics.error();

      expect(recorder.calls, isEmpty);
    });

    test('deux appels rapprochés ne vibrent qu’une fois', () async {
      await ViroHaptics.confirm();
      await ViroHaptics.confirm();

      expect(recorder.calls, hasLength(1));
    });

    test('longPress vibre (seuil) puis appelle l’action', () {
      var calls = 0;
      ViroHaptics.longPress(() => calls++)();

      expect(calls, 1);
      expect(recorder.calls, ['HapticFeedbackType.mediumImpact']);
    });

    test('un appel après l’intervalle minimal vibre de nouveau', () async {
      await ViroHaptics.confirm();
      await Future<void>.delayed(
        ViroHaptics.minInterval + const Duration(milliseconds: 20),
      );
      await ViroHaptics.confirm();

      expect(recorder.calls, hasLength(2));
    });
  });
}
