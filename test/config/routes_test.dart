import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/services/account_service.dart';

void main() {
  group('AppRoutes club admin paths', () {
    test('equipment et settings utilisent les chemins anglais', () {
      expect(
        AppRoutes.clubEquipmentPath('club123'),
        '/club/club123/equipment',
      );
      expect(
        AppRoutes.clubSettingsPath('club123'),
        '/club/club123/settings',
      );
      expect(AppRoutes.clubEquipment, '/club/:clubId/equipment');
      expect(AppRoutes.clubSettings, '/club/:clubId/settings');
    });
  });

  group('AppRoutes user settings', () {
    test('userSettings et profile ont les bons chemins', () {
      expect(AppRoutes.userSettings, '/settings');
      expect(AppRoutes.profile, '/profile');
    });

    test('les sous-pages vivent sous /settings', () {
      expect(AppRoutes.settingsAccount, '/settings/account');
      expect(AppRoutes.settingsDeleteAccount, '/settings/account/delete');
      expect(AppRoutes.settingsNotifications, '/settings/notifications');
      expect(AppRoutes.settingsAppearance, '/settings/appearance');
      expect(AppRoutes.settingsPrivacy, '/settings/privacy');
    });
  });

  group('AppRoutes mise à jour obligatoire', () {
    test('mémorise la route demandée puis y revient', () {
      final requested = Uri.parse('/join?code=ABC');
      final blocked = AppRoutes.updateRequiredPath(from: requested);
      expect(Uri.parse(blocked).path, AppRoutes.updateRequired);
      expect(
        AppRoutes.afterUpdateRequired(Uri.parse(blocked)),
        '/join?code=ABC',
      );
    });

    test('depuis le chargement, pas de route à mémoriser', () {
      expect(
        AppRoutes.updateRequiredPath(from: Uri.parse(AppRoutes.loading)),
        AppRoutes.updateRequired,
      );
      expect(
        AppRoutes.afterUpdateRequired(Uri.parse(AppRoutes.updateRequired)),
        AppRoutes.loading,
      );
    });

    test('ignore une route mémorisée externe', () {
      final location = Uri(
        path: AppRoutes.updateRequired,
        queryParameters: {'from': '//evil.example/x'},
      );
      expect(AppRoutes.afterUpdateRequired(location), AppRoutes.loading);
    });
  });

  group('AccountService.authProviderLabels', () {
    test('retourne email et google quand les deux providers sont présents', () {
      final user = _FakeUser(
        providerIds: ['password', 'google.com'],
      );
      expect(
        AccountService.authProviderLabels(user),
        ['Email / mot de passe', 'Google'],
      );
    });

    test('retourne Inconnu sans provider connu', () {
      final user = _FakeUser(providerIds: ['anonymous']);
      expect(AccountService.authProviderLabels(user), ['Inconnu']);
    });
  });
}

class _FakeUser implements User {
  _FakeUser({required this.providerIds});

  final List<String> providerIds;

  @override
  List<UserInfo> get providerData =>
      providerIds.map((id) => _FakeUserInfo(id)).toList();

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeUserInfo implements UserInfo {
  _FakeUserInfo(this.providerId);

  @override
  final String providerId;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
