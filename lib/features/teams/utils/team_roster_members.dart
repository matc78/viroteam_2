import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';

/// Ids joueurs convoqués (hors coachs), sans doublon.
List<String> dedupedPlayerMemberIds({
  required ClubEvent event,
  required Set<String> excludeCoachUids,
}) =>
    event.playerMemberIds(excludeCoachUids).toSet().toList();

/// `teamMemberIds` à la création d'un événement (ids des fiches membres).
///
/// Inclut joueurs et coachs : chacun peut répondre à sa présence.
List<String> audienceIdsForTeam(ClubTeam team) =>
    {...team.playerIds, ...team.coachIds}.toList();

/// Joueurs (fiches connues) de [teams], dédupliqués et triés par nom.
///
/// `id` = clé `teamMemberIds` / `excludedMemberIds` du joueur (id de la fiche).
List<({String id, ClubMember member})> teamPlayerEntries(
  List<ClubTeam> teams,
  Map<String, ClubMember> membersById,
) {
  final seenMemberIds = <String>{};
  final entries = <({String id, ClubMember member})>[];
  for (final team in teams) {
    for (final rosterId in team.playerIds) {
      final member = membersById[rosterId];
      if (member == null || !seenMemberIds.add(member.memberId)) continue;
      entries.add((id: member.memberId, member: member));
    }
  }
  entries.sort(
    (a, b) => a.member.fullName
        .toLowerCase()
        .compareTo(b.member.fullName.toLowerCase()),
  );
  return entries;
}

/// `true` si le joueur [member] des équipes de [event] n'en a pas été retiré
/// (pas encore synchronisé dans `teamMemberIds` = convoqué quand même).
bool isConvokedOnEvent(ClubEvent event, ClubMember member) =>
    !event.isExcludedFor(member.memberId);

/// Index des membres par id de fiche (= clé roster / RSVP).
Map<String, ClubMember> indexClubMembersById(List<ClubMember> members) => {
      for (final member in members) member.memberId: member,
    };

/// Fiche affichable d'un joueur invité sans compte (`pending_members`).
ClubMember pendingAsClubMember(PendingTeamMember pending) {
  return ClubMember.fromPendingRoster(
    pendingId: pending.id,
    firstName: pending.firstName,
    lastName: pending.lastName,
  );
}
