import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/viro_user.dart';

/// Valeur de `active_role` sans fiche membre dans le club actif (parent
/// seul, ou aucun club actif).
const String analyticsNoRole = 'none';

/// Clé super-propriété PostHog du rôle du club actif (app uniquement).
const String analyticsActiveRoleKey = 'active_role';

/// Valeur de `active_role` : badge principal de la fiche dans le club actif
/// ([ChatBadgeIds] : `admin` | `coach` | `player` | `member`), sinon
/// [analyticsNoRole] sans fiche ([hasMemberDoc] faux).
String analyticsActiveRole({
  required bool hasMemberDoc,
  MemberBadge? badge,
}) =>
    hasMemberDoc
        ? ChatBadgeIds.of(badge ?? MemberBadge.member)
        : analyticsNoRole;

/// Propriétés « personne » PostHog tirées de [user], sans PII (ni nom, ni
/// e-mail, ni téléphone) : parent ou non, nombre de clubs (membre ou
/// parent). Les droits vivent sur chaque fiche club : le badge du club actif
/// part dans la super-propriété `active_role`.
Map<String, Object> analyticsPersonProperties(ViroUser user) {
  final clubIds = {
    ...user.memberClubIds,
    ...user.parentClubIds,
  };
  return {
    'is_parent': user.parentLinks.isNotEmpty,
    'club_count': clubIds.length,
  };
}

/// Propriétés du groupe PostHog `club` pour [club].
Map<String, Object> analyticsClubProperties(Club club) => {
      'name': club.name,
      'sport': club.sport,
      'member_count': club.memberCount,
    };
