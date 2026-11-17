import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// `true` si [event] est un événement spécial : tout le club (`allTeams`) ou
/// sans équipe liée.
bool isSpecialClubEvent(ClubEvent event) =>
    event.allTeams || event.teamIds.isEmpty;

/// Badge d'une ligne de réponse RSVP de [event] pour [member].
///
/// Événement d'équipe : Entraîneur si [coachesEventTeam] (coach d'une équipe
/// de l'événement), sinon aucun badge. Événement spécial
/// ([isSpecialClubEvent]) : Admin si la fiche a le droit `admin`, sinon même
/// règle. Jamais Joueur ni Membre (la liste est déjà celle des convoqués).
ViroRole? planningRsvpRowBadge({
  required ClubEvent event,
  required ClubMember member,
  required bool coachesEventTeam,
}) {
  if (isSpecialClubEvent(event) && member.isAdmin) return ViroRole.admin;
  if (coachesEventTeam) return ViroRole.coach;
  return null;
}
