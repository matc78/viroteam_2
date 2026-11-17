import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/features/home/models/rsvp_push_highlight.dart';
import 'package:viro_team_v2/features/home/providers/rsvp_highlight_offscreen_provider.dart';
import 'package:viro_team_v2/features/home/providers/rsvp_push_highlight_provider.dart';
import 'package:viro_team_v2/models/club_event.dart';

RsvpPushHighlight _highlight({Map<String, RsvpStatus>? statuses}) =>
    RsvpPushHighlight(
      clubId: 'c1',
      statuses: statuses ?? {'e1': RsvpStatus.yes},
      fallbackRoute: AppRoutes.memberPlanning,
    );

void main() {
  group('rsvpPushHighlightFromUri', () {
    test('lit les events et la réponse de chacun', () {
      final highlight = rsvpPushHighlightFromUri(
        Uri.parse(
          'viroteam://planning?rsvpClubId=c1'
          '&rsvpHighlights=e1%3Ayes%2Ce2%3Ano%2Ce3%3Amaybe',
        ),
        fallbackRoute: AppRoutes.memberPlanning,
      );

      expect(highlight, isNotNull);
      expect(highlight!.clubId, 'c1');
      expect(highlight.fallbackRoute, AppRoutes.memberPlanning);
      expect(highlight.statuses, {
        'e1': RsvpStatus.yes,
        'e2': RsvpStatus.no,
        'e3': RsvpStatus.maybe,
      });
      expect(highlight.statusesByEventKey.keys, contains('c1/e1'));
    });

    test('ignore les entrées invalides ou sans réponse', () {
      final highlight = rsvpPushHighlightFromUri(
        Uri.parse(
          'viroteam://planning?rsvpClubId=c1'
          '&rsvpHighlights=e1%3Anone%2C%3Ayes%2Cbroken%2Ce2%3Ano',
        ),
        fallbackRoute: AppRoutes.memberPlanning,
      );

      expect(highlight!.statuses, {'e2': RsvpStatus.no});
    });

    test('null sans paramètres (lien d’une ancienne push)', () {
      expect(
        rsvpPushHighlightFromUri(
          Uri.parse('viroteam://planning?clubId=c1&eventId=e1'),
          fallbackRoute: AppRoutes.memberPlanning,
        ),
        isNull,
      );
      expect(
        rsvpPushHighlightFromUri(
          Uri.parse('viroteam://planning?rsvpHighlights=e1%3Ayes'),
          fallbackRoute: AppRoutes.memberPlanning,
        ),
        isNull,
      );
    });
  });

  group('rsvpPushHighlightProvider', () {
    // testWidgets : horloge simulée pour le Timer du compte à rebours.
    testWidgets('le liseré s’efface après la durée, une fois le compte lancé',
        (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(rsvpPushHighlightProvider.notifier);

      notifier.set(_highlight());
      // Pas de compte à rebours tant que la home n’a rien affiché.
      await tester.pump(ViroMotion.rsvpHighlightDuration * 2);
      expect(container.read(rsvpPushHighlightProvider), isNotNull);

      notifier.startCountdown();
      await tester.pump(
        ViroMotion.rsvpHighlightDuration - const Duration(milliseconds: 1),
      );
      expect(container.read(rsvpPushHighlightProvider), isNotNull);
      await tester.pump(const Duration(milliseconds: 1));
      expect(container.read(rsvpPushHighlightProvider), isNull);
    });

    testWidgets('une nouvelle push remplace le liseré et relance le compte',
        (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(rsvpPushHighlightProvider.notifier);

      notifier
        ..set(_highlight())
        ..startCountdown();
      await tester.pump(const Duration(seconds: 8));
      notifier
        ..set(_highlight(statuses: {'e2': RsvpStatus.no}))
        ..startCountdown();
      await tester.pump(const Duration(seconds: 8));
      expect(
        container.read(rsvpPushHighlightProvider)?.statuses,
        {'e2': RsvpStatus.no},
      );
      await tester.pump(const Duration(seconds: 2));
      expect(container.read(rsvpPushHighlightProvider), isNull);
    });

    test('clear retire le liseré', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(rsvpPushHighlightProvider.notifier);

      notifier
        ..set(_highlight())
        ..clear();
      expect(container.read(rsvpPushHighlightProvider), isNull);
    });
  });

  group('rsvpHighlightOffscreenProvider', () {
    test('agrège haut et bas, reveal appelle le bon callback', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(rsvpHighlightOffscreenProvider.notifier);
      var revealedUp = 0;
      var revealedDown = 0;

      notifier.report(
        'c1/e1',
        RsvpHighlightOffscreenSide.up,
        reveal: () => revealedUp++,
      );
      notifier.report(
        'c1/e2',
        RsvpHighlightOffscreenSide.down,
        reveal: () => revealedDown++,
      );

      expect(
        container.read(rsvpHighlightOffscreenProvider),
        const RsvpHighlightOffscreenHints(up: true, down: true),
      );

      notifier.reveal(RsvpHighlightOffscreenSide.up);
      notifier.reveal(RsvpHighlightOffscreenSide.down);
      expect(revealedUp, 1);
      expect(revealedDown, 1);

      notifier.report('c1/e1', null);
      expect(
        container.read(rsvpHighlightOffscreenProvider),
        const RsvpHighlightOffscreenHints(up: false, down: true),
      );
    });

    test('clear quand le liseré RSVP tombe', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final highlight = container.read(rsvpPushHighlightProvider.notifier);
      final offscreen = container.read(rsvpHighlightOffscreenProvider.notifier);

      highlight.set(_highlight());
      // Force l’écoute (build) du provider offscreen.
      container.read(rsvpHighlightOffscreenProvider);
      offscreen.report(
        'c1/e1',
        RsvpHighlightOffscreenSide.down,
        reveal: () {},
      );
      expect(container.read(rsvpHighlightOffscreenProvider).down, isTrue);

      highlight.clear();
      expect(
        container.read(rsvpHighlightOffscreenProvider),
        RsvpHighlightOffscreenHints.none,
      );
    });
  });
}
