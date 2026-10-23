import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';

/// Clé RSVP / `teamMemberIds` (aligné sur [EventService.resolveAudienceId]).
String rosterAudienceId(ClubMember member) {
  final accountUid = member.accountUid;
  if (accountUid != null && accountUid.isNotEmpty) {
    return member.memberId;
  }
  return member.effectiveUid;
}

/// Ids joueurs convoqués dédupliqués (memberId + accountUid = une personne).
List<String> dedupedPlayerMemberIds({
  required ClubEvent event,
  required Set<String> excludeCoachUids,
  required Map<String, ClubMember> membersByUid,
}) {
  final seenKeys = <String>{};
  final ids = <String>[];
  for (final id in event.playerMemberIds(excludeCoachUids)) {
    final member = clubMemberForTeamUid(membersByUid, id);
    if (member != null) {
      final keys = eventAudienceKeys(member);
      if (keys.any(seenKeys.contains)) continue;
      seenKeys.addAll(keys);
      ids.add(rosterAudienceId(member));
    } else {
      if (seenKeys.contains(id)) continue;
      seenKeys.add(id);
      ids.add(id);
    }
  }
  return ids;
}

/// Tous les identifiants possibles d'un membre sur un événement.
Set<String> eventAudienceKeys(ClubMember member) {
  final keys = ClubTeam.rosterIdVariants(member)
    ..add(rosterAudienceId(member));
  return keys;
}

/// `teamMemberIds` à la création d'un événement (clés RSVP canoniques).
///
/// Inclut joueurs et coachs : chacun peut répondre à sa présence.
List<String> audienceIdsForTeam(
  ClubTeam team,
  Map<String, ClubMember> membersByUid,
) {
  final ids = <String>{};
  for (final rosterUid in {...team.playerIds, ...team.coachIds}) {
    final member = clubMemberForTeamUid(membersByUid, rosterUid);
    ids.add(member != null ? rosterAudienceId(member) : rosterUid);
  }
  return ids.toList();
}

/// Joueurs (fiches connues) de [teams], dédupliqués et triés par nom.
///
/// `id` = clé `teamMemberIds` / `excludedMemberIds` du joueur.
List<({String id, ClubMember member})> teamPlayerEntries(
  List<ClubTeam> teams,
  Map<String, ClubMember> membersByUid,
) {
  final seenMemberIds = <String>{};
  final entries = <({String id, ClubMember member})>[];
  for (final team in teams) {
    for (final rosterUid in team.playerIds) {
      final member = clubMemberForTeamUid(membersByUid, rosterUid);
      if (member == null || !seenMemberIds.add(member.memberId)) continue;
      entries.add((id: rosterAudienceId(member), member: member));
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
    !event.isExcludedFor(eventAudienceKeys(member));

/// Index des membres par toutes les clés roster / RSVP.
Map<String, ClubMember> indexClubMembersByUid(List<ClubMember> members) {
  final map = <String, ClubMember>{};
  for (final m in members) {
    for (final key in eventAudienceKeys(m)) {
      map[key] = m;
    }
  }
  return map;
}

ClubMember? clubMemberForTeamUid(
  Map<String, ClubMember> byUid,
  String uid,
) {
  return byUid[uid];
}

ClubMember pendingAsClubMember(PendingTeamMember pending) {
  return ClubMember.fromPendingRoster(
    pendingId: pending.id,
    firstName: pending.firstName,
    lastName: pending.lastName,
  );
}
