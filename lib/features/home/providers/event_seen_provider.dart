import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/event_service.dart';

/// Envoie le statut « vu » d'une convocation, au plus une fois par session
/// et par cible (`clubId/eventId/audienceId`).
class EventSeenController {
  /// Crée le contrôleur adossé à [eventService].
  EventSeenController(this._eventService);

  final EventService _eventService;
  final Set<String> _sentKeys = {};

  /// Marque [eventId] vu pour [audienceId] ; [viaCallable] pour un enfant.
  ///
  /// Silencieux en cas d'échec (action implicite) : la clé est relâchée pour
  /// retenter au prochain affichage.
  Future<void> markSeen({
    required String clubId,
    required String eventId,
    required String audienceId,
    bool viaCallable = false,
  }) async {
    final key = '$clubId/$eventId/$audienceId';
    if (!_sentKeys.add(key)) return;
    try {
      await _eventService.markSeen(
        clubId: clubId,
        eventId: eventId,
        audienceId: audienceId,
        viaCallable: viaCallable,
      );
    } catch (error) {
      _sentKeys.remove(key);
      debugPrint('markEventSeen: $error');
    }
  }
}

/// Contrôleur « vu » partagé (home membre, planning d'un enfant).
final eventSeenControllerProvider = Provider<EventSeenController>(
  (ref) => EventSeenController(ref.watch(eventServiceProvider)),
);
