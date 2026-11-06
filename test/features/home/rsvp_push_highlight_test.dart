import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/features/home/models/rsvp_push_highlight.dart';
import 'package:viro_team_v2/features/home/providers/rsvp_push_highlight_provider.dart';
import 'package:viro_team_v2/features/planning/widgets/member_upcoming_events_list.dart';
import 'package:viro_team_v2/models/club_event.dart';

ClubEvent _event(String id, {String clubId = 'c1'}) => ClubEvent(
      id: id,
      clubId: clubId,
      type: EventTypes.training,
      title: 'Entraînement',
      date: DateTime(2026, 11, 10),
    );

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

  group('memberHomePreviewCount', () {
    final events = [for (var i = 0; i < 8; i++) _event('e$i')];

    test('aperçu standard sans liseré', () {
      expect(memberHomePreviewCount(events), memberHomePlanningPreviewLimit);
    });

    test('étendu jusqu’au dernier event encadré', () {
      expect(
        memberHomePreviewCount(events, highlightedKeys: ['c1/e1', 'c1/e6']),
        7,
      );
      expect(
        memberHomePreviewCount(events, highlightedKeys: ['c2/e6']),
        memberHomePlanningPreviewLimit,
      );
    });
  });
}
