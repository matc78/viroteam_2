import 'package:flutter/material.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/season_end.dart';

/// Formate une [TimeOfDay] en `HH:mm`.
String addEventFormatTime(TimeOfDay time) =>
    '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

/// Libellé équipe pour les listes déroulantes (`Nom (catégorie)`).
String addEventTeamLabel(ClubTeam team) =>
    team.category != null && team.category!.isNotEmpty
        ? '${team.name} (${team.category})'
        : team.name;

/// Équipes coachées d’abord, puis ordre alphabétique sur le nom.
List<ClubTeam> addEventSortedTeams(List<ClubTeam> teams, ClubMember? member) {
  final sorted = List<ClubTeam>.from(teams);
  sorted.sort((a, b) {
    final aCoached = member != null && a.isOnCoachRoster(member);
    final bCoached = member != null && b.isOnCoachRoster(member);
    if (aCoached != bCoached) return aCoached ? -1 : 1;
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  });
  return sorted;
}

/// Libellé affiché / stocké pour un lieu de pratique.
String addEventPracticeLocationLabel(PracticeLocation location) {
  final address = location.address?.trim();
  if (address != null && address.isNotEmpty) {
    return '${location.name} ($address)';
  }
  return location.name;
}

/// Index du siège s’il existe, sinon le premier lieu, sinon `-1`.
int addEventDefaultLocationIndex(Club club) {
  final locations = club.practiceLocations;
  if (locations.isEmpty) return -1;
  final linked = ClubSetupFormat.linkedHeadquartersIndex(locations);
  if (linked >= 0) return linked;
  final headquarters = ClubSetupFormat.headquartersLocationIndex(
    address: club.address ?? '',
    postalCode: club.postalCode ?? '',
    city: club.city ?? '',
    sport: club.sport,
    locations: locations,
  );
  if (headquarters >= 0) return headquarters;
  return 0;
}

/// RDV = début − 30 min (borné à 00:00).
TimeOfDay addEventMeetingTimeFromStart(TimeOfDay start) {
  final totalMinutes = start.hour * 60 + start.minute - 30;
  final clamped = totalMinutes < 0 ? 0 : totalMinutes;
  return TimeOfDay(hour: clamped ~/ 60, minute: clamped % 60);
}

/// Fin de saison résolue (club ou défaut), bornée au jour de l'événement.
DateTime addEventSeasonRecurrenceEnd(Club? club, DateTime eventDay) {
  final seasonEnd = resolveSeasonEndDate(club?.seasonEndDate, eventDay);
  return recurrenceEndForEventDay(eventDay, seasonEnd);
}

/// Compose le libellé lieu match extérieur (adresse, CP Ville).
String? addEventResolveAwayLocation({
  required String address,
  required String city,
  required String postal,
}) {
  final trimmedAddress = address.trim();
  final trimmedCity = city.trim();
  final trimmedPostal = postal.trim();
  if (trimmedCity.isEmpty ||
      trimmedPostal.isEmpty ||
      trimmedAddress.isEmpty) {
    return null;
  }
  return '$trimmedAddress, $trimmedPostal $trimmedCity';
}

/// Audience (uids) d’une équipe à partir des membres du club.
List<String> addEventAudienceForTeam(
  ClubTeam team,
  List<ClubMember>? members,
) {
  if (members == null || members.isEmpty) {
    return {...team.playerIds, ...team.coachIds}.toList();
  }
  return audienceIdsForTeam(team, indexClubMembersByUid(members));
}
