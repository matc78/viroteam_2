import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Libellés d'affichage planning (évite le doublon titre = nom d'équipe).
abstract final class PlanningEventDisplay {
  static String headline(ClubEvent event) {
    final typeLabel = eventTypeLabel(event.type);
    if (event.type == EventTypes.other) {
      return event.title.isNotEmpty ? event.title : typeLabel;
    }
    // Réunion : pas d'équipe pour porter le détail, le titre reste en tête.
    if (event.type == EventTypes.meeting) return cardTitleLine(event);
    return typeLabel;
  }

  /// Détail (équipe) extrait du titre stocké, sans redoubler le type.
  ///
  /// Couvre les titres portail « Entraînement - Senior 1 » et Flutter « Senior 1 ».
  static String? detailFromStoredTitle(ClubEvent event) {
    if (event.type == EventTypes.other) return null;
    final typeLabel = eventTypeLabel(event.type);
    final trimmed = event.title.trim();
    if (trimmed.isEmpty || trimmed == typeLabel) return null;

    for (final separator in const [' - ', ' – ', ' · ']) {
      final prefix = '$typeLabel$separator';
      if (trimmed.startsWith(prefix)) {
        final rest = trimmed.substring(prefix.length).trim();
        return rest.isEmpty ? null : rest;
      }
    }
    return trimmed;
  }

  /// Ligne compacte type · détail (tuiles home / RSVP).
  static String cardTitleLine(ClubEvent event) {
    if (event.type == EventTypes.other) {
      return event.title.isNotEmpty
          ? event.title
          : eventTypeLabel(event.type);
    }
    final typeLabel = eventTypeLabel(event.type);
    final detail = detailFromStoredTitle(event);
    if (detail == null) return typeLabel;
    return '$typeLabel · $detail';
  }

  /// Titre pour calendrier / .ics (titre custom ou type d'événement).
  static String calendarTitle(ClubEvent event) {
    if (event.type == EventTypes.meeting) return cardTitleLine(event);
    return event.title.isNotEmpty ? event.title : eventTypeLabel(event.type);
  }

  static String? teamLabel(
    ClubEvent event,
    Map<String, ClubTeam> teamsById,
  ) {
    if (event.allTeams) return AppCopy.planning.allClub;
    if (event.teamIds.isEmpty) return null;
    final names = event.teamIds
        .map((id) => teamsById[id]?.name)
        .whereType<String>()
        .toList();
    if (names.isEmpty) return null;
    return names.join(', ');
  }

  static String? subtitle(ClubEvent event, String? teamLabel) {
    if (teamLabel == null || teamLabel.isEmpty) return null;
    if (event.type == EventTypes.other &&
        event.title.isNotEmpty &&
        event.title != teamLabel) {
      return teamLabel;
    }
    if (event.type == EventTypes.training ||
        event.type == EventTypes.match ||
        event.type == EventTypes.meeting) {
      return teamLabel;
    }
    return null;
  }

  static String? locationLine(ClubEvent event) {
    final loc = event.location?.trim();
    if (loc == null || loc.isEmpty) return null;
    return loc;
  }

  /// L'utilisateur [authUid] (= id de sa fiche) est coach d'une équipe liée
  /// à l'événement.
  static bool isCoachForEvent(
    ClubEvent event,
    String authUid,
    Map<String, ClubTeam> teamsById,
  ) {
    final teamIds =
        event.teamIds.isNotEmpty ? event.teamIds : teamsById.keys.toList();
    for (final teamId in teamIds) {
      if (teamsById[teamId]?.coachIds.contains(authUid) ?? false) {
        return true;
      }
    }
    return false;
  }

  /// Coach / admin : convoqué joueur seulement s'il est dans [ClubTeam.playerIds].
  static bool isOnPlayerRosterForEvent(
    ClubEvent event,
    String memberId,
    Map<String, ClubTeam> teamsById,
  ) {
    final teamIds =
        event.teamIds.isNotEmpty ? event.teamIds : teamsById.keys.toList();
    for (final teamId in teamIds) {
      if (teamsById[teamId]?.playerIds.contains(memberId) ?? false) {
        return true;
      }
    }
    return false;
  }

  /// Convoqué joueur (roster `playerIds` / `teamMemberIds`), hors cas coach seul.
  static bool isInvitedAsPlayerOnEvent(
    ClubEvent event,
    String authUid,
    Map<String, ClubTeam> teamsById,
  ) {
    if (!event.isInvitedAsPlayer(authUid)) return false;
    if (!isCoachForEvent(event, authUid, teamsById)) return true;
    return isOnPlayerRosterForEvent(event, authUid, teamsById);
  }

  /// Peut répondre RSVP : joueur convoqué ou coach d'une équipe de l'événement.
  static bool canRsvpOnEvent(
    ClubEvent event,
    String authUid,
    Map<String, ClubTeam> teamsById,
  ) =>
      isInvitedAsPlayerOnEvent(event, authUid, teamsById) ||
      isCoachForEvent(event, authUid, teamsById);

  /// Événement visible pour un joueur / coach membre (hors mode gestion).
  static bool isVisibleToMember({
    required ClubEvent event,
    required String authUid,
    required Set<String> playerTeamIds,
    required Map<String, ClubTeam> teamsById,
  }) {
    if (isCoachForEvent(event, authUid, teamsById)) return true;
    if (event.isExcludedFor(authUid)) return false;
    if (event.allTeams) return true;
    if (event.isInvitedAsPlayer(authUid)) return true;
    if (event.teamIds.any(playerTeamIds.contains)) return true;
    return false;
  }

  /// Identifiants à retirer de la liste / des compteurs RSVP joueurs.
  /// Un coach n'y figure que s'il est aussi dans [ClubTeam.playerIds] (double casquette).
  static Set<String> coachUidsToExclude(
    ClubEvent event,
    Map<String, ClubTeam> teamsById,
  ) {
    final exclude = <String>{};
    final teamIds =
        event.teamIds.isNotEmpty ? event.teamIds : teamsById.keys.toList();

    for (final teamId in teamIds) {
      final team = teamsById[teamId];
      if (team == null) continue;
      for (final coachId in team.coachIds) {
        if (!team.playerIds.contains(coachId)) exclude.add(coachId);
      }
    }
    return exclude;
  }

  /// Compteurs RSVP joueurs + coachs des équipes de l'événement (dédupliqués).
  static ({int yes, int no, int none}) rsvpCountsIncludingCoaches(
    ClubEvent event,
    Map<String, ClubTeam> teamsById,
  ) {
    final memberIds = <String>{
      for (final teamId in event.teamIds) ...?teamsById[teamId]?.coachIds,
      ...event.teamMemberIds,
    };
    var yes = 0;
    var no = 0;
    var none = 0;
    for (final memberId in memberIds) {
      switch (event.rsvpStatusForUser(memberId)) {
        case RsvpStatus.yes:
          yes++;
        case RsvpStatus.no:
          no++;
        case RsvpStatus.maybe:
        case RsvpStatus.none:
          none++;
      }
    }
    return (yes: yes, no: no, none: none);
  }

  static String scheduleLine(ClubEvent event) {
    final date = formatEventDate(event.date);
    final start = formatEventTime(event.startTime);
    final end = formatEventTime(event.endTime);
    final rdv = formatEventTime(event.meetingTime);

    if (event.type == EventTypes.match) {
      final parts = <String>[date];
      if (start.isNotEmpty) parts.add(AppCopy.planning.matchAt(start));
      if (rdv.isNotEmpty) parts.add(AppCopy.planning.rdvAt(rdv));
      return parts.join(' · ');
    }

    final parts = <String>[date];
    if (start.isNotEmpty) {
      parts.add(end.isNotEmpty ? '$start – $end' : start);
    }
    return parts.join(' · ');
  }
}
