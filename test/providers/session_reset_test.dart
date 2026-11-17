import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/providers/session_provider.dart';

/// Uid simulé du compte connecté.
class _FakeUidNotifier extends Notifier<String?> {
  @override
  String? build() => 'uidA';

  void set(String? uid) => state = uid;
}

final _fakeUidProvider =
    NotifierProvider<_FakeUidNotifier, String?>(_FakeUidNotifier.new);

ProviderContainer _container() {
  final container = ProviderContainer(
    overrides: [
      authUidProvider.overrideWith((ref) => ref.watch(_fakeUidProvider)),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('déconnexion : club actif et cible Moi | enfant remis à zéro', () {
    final container = _container();
    container.read(sessionProvider.notifier).setActiveClub('clubA');
    container
        .read(clubAudienceSelectionProvider.notifier)
        .select(clubId: 'clubA', memberId: 'childA');
    expect(container.read(sessionProvider).activeClubId, 'clubA');

    container.read(_fakeUidProvider.notifier).set(null);

    expect(container.read(sessionProvider).hasActiveClub, isFalse);
    expect(container.read(clubAudienceSelectionProvider), isEmpty);
  });

  test('autre compte : aucun état hérité du précédent', () {
    final container = _container();
    container.read(sessionProvider.notifier).setActiveClub('clubA');
    container
        .read(clubAudienceSelectionProvider.notifier)
        .select(clubId: 'clubA', memberId: 'childA');

    container.read(_fakeUidProvider.notifier).set('uidB');

    expect(container.read(sessionProvider).activeClubId, isNull);
    expect(container.read(clubAudienceSelectionProvider), isEmpty);
  });

  test('même compte : la session est conservée', () {
    final container = _container();
    container.read(sessionProvider.notifier).setActiveClub('clubA');

    container.read(_fakeUidProvider.notifier).set('uidA');

    expect(container.read(sessionProvider).activeClubId, 'clubA');
  });
}
