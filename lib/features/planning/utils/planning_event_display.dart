import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';

/// Libellés d'affichage planning (évite le doublon titre = nom d'équipe).
abstract final class PlanningEventDisplay {
  static String headline(ClubEvent event) {
    final typeLabel = eventTypeLabel(event.type);
    if (event.type == EventTypes.other) {
      return event.title.isNotEmpty ? event.title : typeLabel;
    }
    return typeLabel;
  }

  /// Titre pour calendrier / .ics (titre custom ou type d'événement).
  static String calendarTitle(ClubEvent event) =>
      event.title.isNotEmpty ? event.title : eventTypeLabel(event.type);

  static String? teamLabel(
    ClubEvent event,
    Map<String, ClubTeam> teamsById,
  ) {
    if (event.allTeams) return 'Tout le club';
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
        event.type == EventTypes.match) {
      return teamLabel;
    }
    return null;
  }

  static String? locationLine(ClubEvent event) {
    final loc = event.location?.trim();
    if (loc == null || loc.isEmpty) return null;
    return loc;
  }

  /// UIDs des coachs à exclure de la liste / des badges RSVP.
  /// L'utilisateur est coach d'une équipe liée à l'événement.
  static bool isCoachForEvent(
    ClubEvent event,
    String authUid,
    Map<String, ClubTeam> teamsById, {
    ClubMember? member,
    Map<String, ClubMember>? membersByUid,
  }) {
    final resolved = member ??
        (membersByUid != null
            ? clubMemberForTeamUid(membersByUid, authUid)
            : null);

    final teamIds = event.teamIds.isNotEmpty
        ? event.teamIds
        : teamsById.keys.toList();

    if (resolved != null) {
      for (final teamId in teamIds) {
        final team = teamsById[teamId];
        if (team != null && team.isOnCoachRoster(resolved)) return true;
      }
      return false;
    }

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
    ClubMember member,
    Map<String, ClubTeam> teamsById,
  ) {
    final teamIds =
        event.teamIds.isNotEmpty ? event.teamIds : teamsById.keys.toList();
    for (final teamId in teamIds) {
      final team = teamsById[teamId];
      if (team != null && team.isOnPlayerRoster(member)) return true;
    }
    return false;
  }

  /// Convoqué joueur (roster `playerIds` / `teamMemberIds`), hors cas coach seul.
  static bool isInvitedAsPlayerOnEvent(
    ClubEvent event,
    String authUid,
    Map<String, ClubTeam> teamsById, {
    String? clubAudienceId,
    ClubMember? member,
    Map<String, ClubMember>? membersByUid,
  }) {
    final resolved = member ??
        (membersByUid != null
            ? clubMemberForTeamUid(membersByUid, authUid)
            : null);
    final inAudience = event.isInvitedAsPlayer(
      authUid,
      clubAudienceId: clubAudienceId,
      memberAudienceKeys:
          resolved != null ? eventAudienceKeys(resolved) : null,
    );
    if (!inAudience) return false;

    final isCoach = isCoachForEvent(
      event,
      authUid,
      teamsById,
      member: resolved,
      membersByUid: membersByUid,
    );
    if (!isCoach) return true;
    if (resolved == null) return false;
    return isOnPlayerRosterForEvent(event, resolved, teamsById);
  }

  /// Peut répondre RSVP : joueur convoqué ou coach d'une équipe de l'événement.
  static bool canRsvpOnEvent(
    ClubEvent event,
    String authUid,
    Map<String, ClubTeam> teamsById, {
    String? clubAudienceId,
    ClubMember? member,
    Map<String, ClubMember>? membersByUid,
  }) =>
      isInvitedAsPlayerOnEvent(
        event,
        authUid,
        teamsById,
        clubAudienceId: clubAudienceId,
        member: member,
        membersByUid: membersByUid,
      ) ||
      isCoachForEvent(
        event,
        authUid,
        teamsById,
        member: member,
        membersByUid: membersByUid,
      );

  /// Événement visible pour un joueur / coach membre (hors mode gestion).
  static bool isVisibleToMember({
    required ClubEvent event,
    required String authUid,
    required String audienceId,
    required Set<String> playerTeamIds,
    required Map<String, ClubTeam> teamsById,
  }) {
    if (event.allTeams) return true;
    if (event.isInvitedAsPlayer(authUid, clubAudienceId: audienceId)) {
      return true;
    }
    if (isCoachForEvent(event, authUid, teamsById)) return true;
    if (event.teamIds.any(playerTeamIds.contains)) return true;
    return false;
  }

  /// Identifiants à retirer de la liste / des compteurs RSVP joueurs.
  /// Un coach n'y figure que s'il est aussi dans [ClubTeam.playerIds] (double casquette).
  static Set<String> coachUidsToExclude(
    ClubEvent event,
    Map<String, ClubTeam> teamsById, {
    Map<String, ClubMember>? membersByUid,
  }) {
    final exclude = <String>{};
    final teamIds =
        event.teamIds.isNotEmpty ? event.teamIds : teamsById.keys.toList();

    for (final teamId in teamIds) {
      final team = teamsById[teamId];
      if (team == null) continue;

      for (final coachAuthUid in team.coachIds) {
        final member = membersByUid != null
            ? clubMemberForTeamUid(membersByUid, coachAuthUid)
            : null;
        final onPlayerRoster = member != null
            ? team.isOnPlayerRoster(member)
            : team.playerIds.contains(coachAuthUid);

        if (!onPlayerRoster) {
          exclude.add(coachAuthUid);
          if (member != null) {
            exclude.addAll(eventAudienceKeys(member));
          }
        }
      }
    }
    return exclude;
  }

  /// Compteurs RSVP joueurs + coachs des équipes de l'événement (dédupliqués).
  static ({int yes, int no, int none}) rsvpCountsIncludingCoaches(
    ClubEvent event,
    Map<String, ClubTeam> teamsById, {
    Map<String, ClubMember>? membersByUid,
  }) {
    final countedKeys = <String>{};
    var yes = 0;
    var no = 0;
    var none = 0;

    void addPerson(String primaryId, ClubMember? member) {
      final keys = member != null ? eventAudienceKeys(member) : {primaryId};
      if (keys.any(countedKeys.contains)) return;
      countedKeys.addAll(keys);

      final status = member != null
          ? event.rsvpStatusForUser(
              primaryId,
              clubAudienceId: member.memberId,
              memberAudienceKeys: keys,
            )
          : event.rsvpFor(primaryId);

      switch (status) {
        case RsvpStatus.yes:
          yes++;
        case RsvpStatus.no:
          no++;
        case RsvpStatus.maybe:
        case RsvpStatus.none:
          none++;
      }
    }

    for (final teamId in event.teamIds) {
      final team = teamsById[teamId];
      if (team == null) continue;
      for (final coachRosterId in team.coachIds) {
        final member = membersByUid != null
            ? clubMemberForTeamUid(membersByUid, coachRosterId)
            : null;
        addPerson(
          member != null ? rosterAudienceId(member) : coachRosterId,
          member,
        );
      }
    }

    for (final memberId in event.teamMemberIds) {
      final member = membersByUid != null
          ? clubMemberForTeamUid(membersByUid, memberId)
          : null;
      addPerson(memberId, member);
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
      if (start.isNotEmpty) parts.add('Match $start');
      if (rdv.isNotEmpty) parts.add('RDV $rdv');
      return parts.join(' · ');
    }

    final parts = <String>[date];
    if (start.isNotEmpty) {
      parts.add(end.isNotEmpty ? '$start – $end' : start);
    }
    return parts.join(' · ');
  }
}
