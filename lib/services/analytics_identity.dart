import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/viro_user.dart';

/// Valeur de `max_role` / `active_role` pour un compte sans fiche membre
/// (parent seul ou session sans rôle).
const String analyticsNoRole = 'none';

/// Clé super-propriété PostHog du rôle du club actif (app uniquement).
const String analyticsActiveRoleKey = 'active_role';

/// Rôle analytics pour la session club : rôle membre, sinon [analyticsNoRole].
String analyticsActiveRole(String? sessionRole) {
  final role = sessionRole?.trim() ?? '';
  return role.isEmpty ? analyticsNoRole : role;
}

/// Propriétés « personne » PostHog tirées de [user], sans PII (ni nom, ni
/// e-mail, ni téléphone) : rôle club le plus élevé, parent ou non, nombre
/// de clubs (membre ou parent).
Map<String, Object> analyticsPersonProperties(ViroUser user) {
  var maxRole = analyticsNoRole;
  for (final membership in user.clubMemberships) {
    if (MemberRoleHierarchy.level(membership.role) >
        MemberRoleHierarchy.level(maxRole)) {
      maxRole = membership.role;
    }
  }
  final clubIds = {
    for (final membership in user.clubMemberships) membership.clubId,
    ...user.parentClubIds,
  };
  return {
    'max_role': maxRole,
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
