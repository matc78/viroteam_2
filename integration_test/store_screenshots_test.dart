// Captures d'écran App Store — navigation et lecture seules, aucune écriture.
//
// Lancer (simulateur) :
//   flutter drive --driver=test_driver/integration_test.dart \
//     --target=integration_test/store_screenshots_test.dart -d <UDID> \
//     --dart-define=FORCE_PROD_BACKEND=true --dart-define=SKIP_PUSH_PERMISSION=true \
//     --dart-define=SHOT_EMAIL=... --dart-define=SHOT_PASSWORD=...
//
// À chaque écran le test imprime `SHOT_MARK <nom>` puis attend
// [_holdPerScreen] : un script externe fait alors la capture avec
// `xcrun simctl io <UDID> screenshot` (binding.takeScreenshot rend des
// images vides sur iOS).
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:integration_test/integration_test.dart';

import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/club/screens/club_detail_screen.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/fees/screens/my_fee_screen.dart';
import 'package:viro_team_v2/features/home/screens/home_member_screen.dart';
import 'package:viro_team_v2/features/home/widgets/club_selector_bar.dart';
import 'package:viro_team_v2/features/home/widgets/home_quiet_content.dart';
import 'package:viro_team_v2/features/planning/widgets/member_upcoming_events_list.dart';
import 'package:viro_team_v2/features/planning/screens/member_planning_screen.dart';
import 'package:viro_team_v2/main.dart' as app;

const _email = String.fromEnvironment('SHOT_EMAIL');
const _password = String.fromEnvironment('SHOT_PASSWORD');
const _holdPerScreen = Duration(seconds: 6);

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('store screenshots', (tester) async {
    expect(_email.isNotEmpty && _password.isNotEmpty, isTrue,
        reason: 'SHOT_EMAIL / SHOT_PASSWORD manquants');

    // main() remplace FlutterError.onError (Crashlytics) : on remet celui du
    // binding de test, sinon flutter_test échoue en fin de test.
    final testOnError = FlutterError.onError;
    await app.main();
    FlutterError.onError = testOnError;
    await tester.pumpAndSettle();

    // Session persistée d'un run précédent : on se déconnecte d'abord
    // (aucune écriture Firestore, seulement la session Auth locale).
    await _waitForAny(tester, [
      find.text('Bienvenue sur ViroTeam'),
      find.byType(HomeMemberScreen),
    ], timeout: const Duration(seconds: 90));
    if (find.byType(HomeMemberScreen).evaluate().isNotEmpty) {
      await FirebaseAuth.instance.signOut();
    }

    // 1) Accueil (avant connexion).
    await _waitFor(tester, find.text('Bienvenue sur ViroTeam'),
        timeout: const Duration(seconds: 60));
    await _settle(tester, const Duration(seconds: 2));
    await _shoot(tester, binding, '01_welcome');

    // Connexion.
    await tester.tap(find.text('Déjà un compte ? Se connecter'));
    await _waitFor(tester, find.byType(TextFormField));
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), _email);
    await tester.enterText(fields.at(1), _password);
    FocusManager.instance.primaryFocus?.unfocus();
    await _settle(tester, const Duration(milliseconds: 500));
    await tester.tap(find.text('Se connecter'));

    // 2) Home membre.
    await _waitFor(tester, find.byType(HomeMemberScreen),
        timeout: const Duration(seconds: 90));
    // Clubs chargés (barre des clubs) puis planning ou état « terrain libre ».
    await _waitFor(tester, find.byType(ClubSelectorBar),
        timeout: const Duration(seconds: 90));
    await _waitForAny(
      tester,
      [find.byType(MemberUpcomingEventsSliver), find.byType(HomeQuietContent)],
      timeout: const Duration(seconds: 90),
    );
    await _settle(tester, const Duration(seconds: 4));
    await _shoot(tester, binding, '02_home');

    final homeElement = tester.element(find.byType(HomeMemberScreen));
    final router = GoRouter.of(homeElement);
    final container = ProviderScope.containerOf(homeElement);
    final clubs = container.read(userClubsProvider).value ?? const [];
    expect(clubs, isNotEmpty, reason: 'aucun club pour ce compte');
    final clubId = clubs.first.club.id;

    // 3) Planning.
    router.push(AppRoutes.memberPlanning);
    await _waitFor(tester, find.byType(MemberPlanningScreen));
    await _settle(tester, const Duration(seconds: 4));
    await _shoot(tester, binding, '03_planning');
    router.pop();
    await _settle(tester, const Duration(seconds: 1));

    // 4) Fiche club.
    router.push(AppRoutes.clubDetailPath(clubId));
    await _waitFor(tester, find.byType(ClubDetailScreen));
    await _settle(tester, const Duration(seconds: 5));
    await _shoot(tester, binding, '04_club');

    // 5) Ma cotisation.
    router.push(AppRoutes.clubMyFeePath(clubId));
    await _waitFor(tester, find.byType(MyFeeScreen));
    await _settle(tester, const Duration(seconds: 5));
    await _shoot(tester, binding, '05_fee');

    // ignore: avoid_print
    print('SHOT_DONE');
    await _settle(tester, const Duration(seconds: 2));
  });
}

/// Pompe des frames en temps réel jusqu'à ce que [finder] apparaisse.
Future<void> _waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 45),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }
  throw TestFailure('Widget introuvable après $timeout : $finder');
}

Future<void> _waitForAny(
  WidgetTester tester,
  List<Finder> finders, {
  Duration timeout = const Duration(seconds: 45),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finders.any((f) => f.evaluate().isNotEmpty)) return;
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }
  throw TestFailure('Aucun widget trouvé après $timeout : $finders');
}

/// Laisse l'écran se stabiliser (données Firestore, images) en temps réel.
Future<void> _settle(WidgetTester tester, Duration duration) async {
  final end = DateTime.now().add(duration);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 100));
    await Future<void>.delayed(const Duration(milliseconds: 100));
  }
}

Future<void> _shoot(
  WidgetTester tester,
  IntegrationTestWidgetsFlutterBinding binding,
  String name,
) async {
  // La capture est faite de l'extérieur (`xcrun simctl io … screenshot`)
  // par un script qui lit ce marqueur ; le test se contente d'attendre.
  // ignore: avoid_print
  print('SHOT_MARK $name');
  await _settle(tester, _holdPerScreen);
}
