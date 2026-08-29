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
