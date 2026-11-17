import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/sign_up_intent_preference_service.dart';

Future<ProviderContainer> _container() async {
  final preferences = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    overrides: [
      signUpIntentPreferenceServiceProvider.overrideWithValue(
        SignUpIntentPreferenceService(preferences: preferences),
      ),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('sans valeur enregistrée : intention fondateur', () async {
    SharedPreferences.setMockInitialValues({});
    final container = await _container();
    expect(container.read(signUpIntentProvider), SignUpIntent.founder);
  });

  test('« rejoindre » survit au relancement de l’app', () async {
    SharedPreferences.setMockInitialValues({});
    final first = await _container();
    first.read(signUpIntentProvider.notifier).setIntent(SignUpIntent.join);
    await pumpEventQueue();

    // Nouveau conteneur = app relancée, mêmes préférences.
    final relaunched = await _container();
    expect(relaunched.read(signUpIntentProvider), SignUpIntent.join);
  });
}
