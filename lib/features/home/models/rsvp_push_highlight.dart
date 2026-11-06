import 'package:viro_team_v2/models/club_event.dart';

/// Events à encadrer sur la home après un tap sur une push RSVP, avec la
/// couleur de la réponse la plus récente.
class RsvpPushHighlight {
  const RsvpPushHighlight({
    required this.clubId,
    required this.statuses,
    required this.fallbackRoute,
  });

  final String clubId;

  /// Réponse à afficher par id d'event (jamais [RsvpStatus.none]).
  final Map<String, RsvpStatus> statuses;

  /// Route d'origine du lien, ouverte si aucun event n'est sur la home.
  final String fallbackRoute;

  /// Clé d'event utilisée par les listes multi-clubs (`clubId/eventId`).
  static String eventKey(String clubId, String eventId) => '$clubId/$eventId';

  /// Réponses indexées par [eventKey].
  Map<String, RsvpStatus> get statusesByEventKey => {
        for (final entry in statuses.entries)
          eventKey(clubId, entry.key): entry.value,
      };
}

/// Lit `rsvpHighlights=<eventId>:<statut>,…` + `rsvpClubId` d'un deep link
/// de push RSVP. `null` si absent ou sans entrée exploitable.
///
/// [fallbackRoute] : route que le lien ouvrait avant (planning).
RsvpPushHighlight? rsvpPushHighlightFromUri(
  Uri uri, {
  required String fallbackRoute,
}) {
  final clubId = uri.queryParameters['rsvpClubId']?.trim() ?? '';
  final raw = uri.queryParameters['rsvpHighlights']?.trim() ?? '';
  if (clubId.isEmpty || raw.isEmpty) return null;

  final statuses = <String, RsvpStatus>{};
  for (final part in raw.split(',')) {
    final separator = part.lastIndexOf(':');
    if (separator <= 0) continue;
    final eventId = part.substring(0, separator).trim();
    final status = RsvpStatus.fromString(part.substring(separator + 1).trim());
    if (eventId.isEmpty || status == RsvpStatus.none) continue;
    statuses[eventId] = status;
  }
  if (statuses.isEmpty) return null;

  return RsvpPushHighlight(
    clubId: clubId,
    statuses: statuses,
    fallbackRoute: fallbackRoute,
  );
}
